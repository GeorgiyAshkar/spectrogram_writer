import type { MusicSettings, NoteEvent } from '../model/types';

export const MIDI_PPQ = 480;
export const FREEHAND_PITCH_BEND_RANGE_SEMITONES = 48;
const PITCH_BEND_STEP_TICKS = Math.max(1, Math.round(MIDI_PPQ / 16));
const DRUM_CHANNEL = 9;
const STANDARD_MELODIC_CHANNEL = 0;
const EXPRESSIVE_CHANNELS = [
  1, 2, 3, 4, 5, 6, 7, 8,
  10, 11, 12, 13, 14, 15,
] as const;

function writeUint32(bytes: number[], value: number) {
  bytes.push((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
}

function writeUint16(bytes: number[], value: number) {
  bytes.push((value >>> 8) & 0xff, value & 0xff);
}

function writeAscii(bytes: number[], value: string) {
  for (let i = 0; i < value.length; i += 1) bytes.push(value.charCodeAt(i) & 0xff);
}

function variableLength(value: number): number[] {
  let buffer = Math.max(0, Math.floor(value)) & 0x0fffffff;
  const output = [buffer & 0x7f];

  while ((buffer >>= 7) > 0) {
    output.unshift((buffer & 0x7f) | 0x80);
  }

  return output;
}

export type MidiMessage = {
  tick: number;
  priority: number;
  bytes: number[];
};

function clampMidiNote(value: number): number {
  return Math.min(127, Math.max(0, Math.round(value)));
}

export function pitchBend14BitForSemitones(
  offsetSemitones: number,
  rangeSemitones = FREEHAND_PITCH_BEND_RANGE_SEMITONES,
): number {
  const safeRange = Math.max(1e-9, Math.abs(rangeSemitones));
  const normalized = Math.min(1, Math.max(-1, offsetSemitones / safeRange));
  return Math.min(16383, Math.max(0, Math.round(8192 + normalized * 8191)));
}

function pitchBendBytes(channel: number, value14Bit: number): number[] {
  const value = Math.min(16383, Math.max(0, Math.round(value14Bit)));
  return [
    0xe0 | channel,
    value & 0x7f,
    (value >>> 7) & 0x7f,
  ];
}

function pitchBendRangeMessages(channel: number): MidiMessage[] {
  const range = Math.min(127, Math.max(0, Math.round(FREEHAND_PITCH_BEND_RANGE_SEMITONES)));
  return [
    { tick: 0, priority: -20, bytes: [0xb0 | channel, 101, 0] },
    { tick: 0, priority: -19, bytes: [0xb0 | channel, 100, 0] },
    { tick: 0, priority: -18, bytes: [0xb0 | channel, 6, range] },
    { tick: 0, priority: -17, bytes: [0xb0 | channel, 38, 0] },
    { tick: 0, priority: -16, bytes: [0xb0 | channel, 101, 127] },
    { tick: 0, priority: -15, bytes: [0xb0 | channel, 100, 127] },
  ];
}

function needsPitchBend(event: NoteEvent): boolean {
  const endMidi = event.endMidi ?? event.midi;
  return (
    Math.abs(event.midi - Math.round(event.midi)) > 1e-6 ||
    Math.abs(endMidi - Math.round(endMidi)) > 1e-6 ||
    Math.abs(endMidi - event.midi) > 1e-6
  );
}

type ExpressiveAssignment = {
  event: NoteEvent;
  startTick: number;
  endTick: number;
  channel: number | null;
};

function assignExpressiveChannels(events: readonly NoteEvent[]): Map<string, number | null> {
  const expressive = events
    .filter((event) => !event.layerId.startsWith('accompaniment:drums') && needsPitchBend(event))
    .map((event) => {
      const startTick = Math.max(0, Math.round(event.startBeat * MIDI_PPQ));
      const endTick = startTick + Math.max(1, Math.round(event.durationBeats * MIDI_PPQ));
      return { event, startTick, endTick };
    })
    .sort((a, b) => a.startTick - b.startTick || a.endTick - b.endTick);

  const busyUntil = new Map<number, number>();
  const assignments = new Map<string, number | null>();

  for (const item of expressive) {
    let channel: number | null = null;
    for (const candidate of EXPRESSIVE_CHANNELS) {
      if ((busyUntil.get(candidate) ?? -1) <= item.startTick) {
        channel = candidate;
        break;
      }
    }

    assignments.set(item.event.id, channel);
    if (channel !== null) busyUntil.set(channel, item.endTick);
  }

  return assignments;
}

function addDiscreteNote(
  messages: MidiMessage[],
  event: NoteEvent,
  channel: number,
): void {
  const startTick = Math.max(0, Math.round(event.startBeat * MIDI_PPQ));
  const durationTicks = Math.max(1, Math.round(event.durationBeats * MIDI_PPQ));
  const endTick = startTick + durationTicks;
  const midi = clampMidiNote(event.midi);
  const velocity = Math.min(127, Math.max(1, Math.round(event.velocity * 127)));

  messages.push({
    tick: startTick,
    priority: 2,
    bytes: [0x90 | channel, midi, velocity],
  });
  messages.push({
    tick: endTick,
    priority: 1,
    bytes: [0x80 | channel, midi, 0],
  });
}

function addExpressiveNote(
  messages: MidiMessage[],
  event: NoteEvent,
  channel: number,
): void {
  const startTick = Math.max(0, Math.round(event.startBeat * MIDI_PPQ));
  const durationTicks = Math.max(1, Math.round(event.durationBeats * MIDI_PPQ));
  const endTick = startTick + durationTicks;
  const endMidi = event.endMidi ?? event.midi;
  const baseMidi = clampMidiNote(event.midi);
  const velocity = Math.min(127, Math.max(1, Math.round(event.velocity * 127)));

  const addBendAt = (tick: number, midi: number, priority: number) => {
    messages.push({
      tick,
      priority,
      bytes: pitchBendBytes(
        channel,
        pitchBend14BitForSemitones(midi - baseMidi),
      ),
    });
  };

  addBendAt(startTick, event.midi, 1);
  messages.push({
    tick: startTick,
    priority: 2,
    bytes: [0x90 | channel, baseMidi, velocity],
  });

  if (Math.abs(endMidi - event.midi) > 1e-9) {
    for (
      let tick = startTick + PITCH_BEND_STEP_TICKS;
      tick < endTick;
      tick += PITCH_BEND_STEP_TICKS
    ) {
      const progress = (tick - startTick) / durationTicks;
      const midi = event.midi + (endMidi - event.midi) * progress;
      addBendAt(tick, midi, 0);
    }
    addBendAt(endTick, endMidi, 0);
  }

  messages.push({
    tick: endTick,
    priority: 1,
    bytes: [0x80 | channel, baseMidi, 0],
  });
  messages.push({
    tick: endTick,
    priority: 3,
    bytes: pitchBendBytes(channel, 8192),
  });
}

export function buildMidiMessages(
  events: readonly NoteEvent[],
  settings: Pick<MusicSettings, 'bpm'>,
): MidiMessage[] {
  const messages: MidiMessage[] = [];
  const bpm = Math.max(1, settings.bpm);
  const microsPerQuarter = Math.round(60_000_000 / bpm);

  messages.push({
    tick: 0,
    priority: -30,
    bytes: [
      0xff,
      0x51,
      0x03,
      (microsPerQuarter >>> 16) & 0xff,
      (microsPerQuarter >>> 8) & 0xff,
      microsPerQuarter & 0xff,
    ],
  });

  const assignments = assignExpressiveChannels(events);
  const usedExpressiveChannels = new Set<number>();
  for (const channel of assignments.values()) {
    if (channel !== null) usedExpressiveChannels.add(channel);
  }
  for (const channel of usedExpressiveChannels) {
    messages.push(...pitchBendRangeMessages(channel));
  }

  for (const event of events) {
    if (event.layerId.startsWith('accompaniment:drums')) {
      addDiscreteNote(messages, event, DRUM_CHANNEL);
      continue;
    }

    const expressiveChannel = assignments.get(event.id);
    if (expressiveChannel !== undefined && expressiveChannel !== null) {
      addExpressiveNote(messages, event, expressiveChannel);
      continue;
    }

    // If every expressive channel is occupied, preserve a playable export by
    // falling back to a rounded discrete note on channel 1 instead of applying
    // a conflicting pitch bend to another simultaneous voice.
    addDiscreteNote(messages, event, STANDARD_MELODIC_CHANNEL);
  }

  return messages.sort((a, b) => a.tick - b.tick || a.priority - b.priority);
}

export function renderNoteEventsToMidiBlob(
  events: readonly NoteEvent[],
  settings: Pick<MusicSettings, 'bpm'>,
): Blob {
  const messages = buildMidiMessages(events, settings);

  const track: number[] = [];
  let previousTick = 0;
  for (const message of messages) {
    const delta = message.tick - previousTick;
    track.push(...variableLength(delta), ...message.bytes);
    previousTick = message.tick;
  }

  track.push(0x00, 0xff, 0x2f, 0x00);

  const file: number[] = [];
  writeAscii(file, 'MThd');
  writeUint32(file, 6);
  writeUint16(file, 0);
  writeUint16(file, 1);
  writeUint16(file, MIDI_PPQ);

  writeAscii(file, 'MTrk');
  writeUint32(file, track.length);
  file.push(...track);

  return new Blob([new Uint8Array(file)], { type: 'audio/midi' });
}

export function renderNoteEventsToMidiUrl(
  events: readonly NoteEvent[],
  settings: Pick<MusicSettings, 'bpm'>,
): string {
  return URL.createObjectURL(renderNoteEventsToMidiBlob(events, settings));
}
