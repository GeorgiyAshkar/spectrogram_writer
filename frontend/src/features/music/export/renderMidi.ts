import type { MusicSettings, NoteEvent } from '../model/types';

const PPQ = 480;

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
  let output = [buffer & 0x7f];

  while ((buffer >>= 7) > 0) {
    output.unshift((buffer & 0x7f) | 0x80);
  }

  return output;
}

type MidiMessage = {
  tick: number;
  priority: number;
  bytes: number[];
};

export function renderNoteEventsToMidiBlob(
  events: readonly NoteEvent[],
  settings: Pick<MusicSettings, 'bpm'>,
): Blob {
  const messages: MidiMessage[] = [];
  const bpm = Math.max(1, settings.bpm);
  const microsPerQuarter = Math.round(60_000_000 / bpm);

  messages.push({
    tick: 0,
    priority: 0,
    bytes: [
      0xff,
      0x51,
      0x03,
      (microsPerQuarter >>> 16) & 0xff,
      (microsPerQuarter >>> 8) & 0xff,
      microsPerQuarter & 0xff,
    ],
  });

  for (const event of events) {
    const startTick = Math.max(0, Math.round(event.startBeat * PPQ));
    const durationTicks = Math.max(1, Math.round(event.durationBeats * PPQ));
    const endTick = startTick + durationTicks;
    const midi = Math.min(127, Math.max(0, Math.round(event.midi)));
    const velocity = Math.min(127, Math.max(1, Math.round(event.velocity * 127)));

    messages.push({
      tick: startTick,
      priority: 2,
      bytes: [0x90, midi, velocity],
    });
    messages.push({
      tick: endTick,
      priority: 1,
      bytes: [0x80, midi, 0],
    });
  }

  messages.sort((a, b) => a.tick - b.tick || a.priority - b.priority);

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
  writeUint16(file, PPQ);

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
