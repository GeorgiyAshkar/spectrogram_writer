import { useEffect, useState } from 'react';

type MidiMessageEventLike = {
  data: Uint8Array;
};

type MidiInputLike = {
  id: string;
  name?: string | null;
  manufacturer?: string | null;
  state?: string;
  onmidimessage: ((event: MidiMessageEventLike) => void) | null;
};

type MidiAccessLike = {
  inputs: Map<string, MidiInputLike>;
  onstatechange: (() => void) | null;
};

type NavigatorWithMidi = {
  requestMIDIAccess?: () => Promise<MidiAccessLike>;
};

export type MidiInputStatus =
  | 'off'
  | 'unsupported'
  | 'requesting'
  | 'ready'
  | 'no-devices'
  | 'denied';

type Options = {
  enabled: boolean;
  onNoteOn: (midi: number, velocity: number, deviceId: string) => void;
  onNoteOff: (midi: number, deviceId: string) => void;
};

export function useWebMidiInput({ enabled, onNoteOn, onNoteOff }: Options) {
  const [status, setStatus] = useState<MidiInputStatus>('off');
  const [devices, setDevices] = useState<string[]>([]);

  useEffect(() => {
    if (!enabled) {
      setStatus('off');
      setDevices([]);
      return;
    }

    const navigatorWithMidi = navigator as unknown as NavigatorWithMidi;
    if (typeof navigatorWithMidi.requestMIDIAccess !== 'function') {
      setStatus('unsupported');
      setDevices([]);
      return;
    }

    let cancelled = false;
    let access: MidiAccessLike | null = null;
    const wiredInputs = new Set<MidiInputLike>();
    const activeNotes = new Map<string, { midi: number; deviceId: string }>();

    const releaseActiveNotes = () => {
      for (const { midi, deviceId } of activeNotes.values()) {
        onNoteOff(midi, deviceId);
      }
      activeNotes.clear();
    };

    const clearInputs = () => {
      releaseActiveNotes();
      for (const input of wiredInputs) input.onmidimessage = null;
      wiredInputs.clear();
    };

    const wireInputs = () => {
      if (!access || cancelled) return;
      clearInputs();

      const available = [...access.inputs.values()].filter((input) => input.state !== 'disconnected');
      setDevices(
        available.map((input) => input.name || input.manufacturer || `MIDI ${input.id}`),
      );
      setStatus(available.length > 0 ? 'ready' : 'no-devices');

      for (const input of available) {
        input.onmidimessage = (event) => {
          const [statusByte = 0, note = 0, velocityRaw = 0] = event.data;
          const command = statusByte & 0xf0;
          const velocity = velocityRaw / 127;

          const noteKey = `${input.id}:${note}`;
          if (command === 0x90 && velocityRaw > 0) {
            activeNotes.set(noteKey, { midi: note, deviceId: input.id });
            onNoteOn(note, velocity, input.id);
          } else if (command === 0x80 || (command === 0x90 && velocityRaw === 0)) {
            activeNotes.delete(noteKey);
            onNoteOff(note, input.id);
          }
        };
        wiredInputs.add(input);
      }
    };

    setStatus('requesting');
    void navigatorWithMidi
      .requestMIDIAccess()
      .then((nextAccess) => {
        if (cancelled) return;
        access = nextAccess;
        access.onstatechange = wireInputs;
        wireInputs();
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('denied');
          setDevices([]);
        }
      });

    return () => {
      cancelled = true;
      clearInputs();
      if (access) access.onstatechange = null;
    };
  }, [enabled, onNoteOff, onNoteOn]);

  return { status, devices };
}
