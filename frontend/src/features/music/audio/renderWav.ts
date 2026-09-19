import { midiToFrequency } from '../model/theory';
import type { MusicSettings, NoteEvent } from '../model/types';

function writeAscii(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

export function renderNoteEventsToWavBlob(
  events: readonly NoteEvent[],
  settings: Pick<MusicSettings, 'bpm' | 'loopLengthBeats' | 'tuningCents'>,
  sampleRate = 44100,
): Blob {
  const bpm = Math.max(1, settings.bpm);
  const secondsPerBeat = 60 / bpm;
  const loopDuration = Math.max(0.05, settings.loopLengthBeats * secondsPerBeat);
  const releaseTail = 0.08;
  const totalSamples = Math.ceil((loopDuration + releaseTail) * sampleRate);
  const pcm = new Float32Array(totalSamples);

  for (const event of events) {
    const startSeconds = event.startBeat * secondsPerBeat;
    const durationSeconds = Math.max(0.01, event.durationBeats * secondsPerBeat);
    const startSample = Math.max(0, Math.floor(startSeconds * sampleRate));
    const endSample = Math.min(totalSamples, Math.ceil((startSeconds + durationSeconds) * sampleRate));
    const frequency = midiToFrequency(event.midi, settings.tuningCents);
    const gain = Math.min(1, Math.max(0, event.velocity)) * 0.42;

    for (let sampleIndex = startSample; sampleIndex < endSample; sampleIndex += 1) {
      const t = (sampleIndex - startSample) / sampleRate;
      const attack = Math.min(1, t / 0.015);
      const timeToEnd = durationSeconds - t;
      const release = Math.min(1, Math.max(0, timeToEnd / 0.06));
      const envelope = Math.min(attack, release);
      pcm[sampleIndex] += Math.sin(2 * Math.PI * frequency * t) * gain * envelope;
    }
  }

  let peak = 0;
  for (let i = 0; i < pcm.length; i += 1) {
    peak = Math.max(peak, Math.abs(pcm[i]));
  }
  const normalization = peak > 0.98 ? 0.98 / peak : 1;

  const bytes = new ArrayBuffer(44 + totalSamples * 2);
  const view = new DataView(bytes);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + totalSamples * 2, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, totalSamples * 2, true);

  let offset = 44;
  for (let i = 0; i < totalSamples; i += 1) {
    const sample = Math.max(-1, Math.min(1, pcm[i] * normalization));
    view.setInt16(offset, Math.round(sample * 32767), true);
    offset += 2;
  }

  return new Blob([bytes], { type: 'audio/wav' });
}

export function renderNoteEventsToWavUrl(
  events: readonly NoteEvent[],
  settings: Pick<MusicSettings, 'bpm' | 'loopLengthBeats' | 'tuningCents'>,
  sampleRate = 44100,
): string {
  return URL.createObjectURL(renderNoteEventsToWavBlob(events, settings, sampleRate));
}
