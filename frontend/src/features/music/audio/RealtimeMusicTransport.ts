import { midiToFrequency } from '../model/theory';
import type { MusicSettings, NoteEvent } from '../model/types';

type ScheduledSource = OscillatorNode;

type LiveVoice = {
  oscillator: OscillatorNode;
  gain: GainNode;
};

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SECONDS = 0.12;
const START_DELAY_SECONDS = 0.025;

function modulo(value: number, divisor: number): number {
  if (divisor <= 0) return 0;
  return ((value % divisor) + divisor) % divisor;
}

export class RealtimeMusicTransport {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private events: NoteEvent[] = [];
  private settings: MusicSettings;
  private timer: number | null = null;
  private scheduledSources = new Set<ScheduledSource>();
  private liveVoices = new Map<string, LiveVoice>();
  private playing = false;
  private pausedBeat = 0;
  private anchorBeat = 0;
  private anchorContextTime = 0;
  private scheduleCursorBeat = 0;

  constructor(settings: MusicSettings) {
    this.settings = settings;
  }

  private async ensureContext(): Promise<AudioContext> {
    if (!this.context) {
      this.context = new AudioContext();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = 0.72;
      this.masterGain.connect(this.context.destination);
    }

    if (this.context.state === 'suspended') {
      await this.context.resume();
    }

    return this.context;
  }

  setProject(events: readonly NoteEvent[], settings: MusicSettings): void {
    const wasPlaying = this.playing;
    const position = this.getPositionBeat();

    this.events = [...events].sort((a, b) => a.startBeat - b.startBeat || a.midi - b.midi);
    this.settings = settings;

    if (wasPlaying) {
      this.restartAt(position);
    } else {
      this.pausedBeat = Math.min(Math.max(0, position), Math.max(0, settings.loopLengthBeats));
    }
  }

  async play(): Promise<void> {
    if (this.playing) return;
    const context = await this.ensureContext();
    const loopLength = Math.max(0.001, this.settings.loopLengthBeats);

    this.playing = true;
    this.anchorBeat = modulo(this.pausedBeat, loopLength);
    this.anchorContextTime = context.currentTime + START_DELAY_SECONDS;
    this.scheduleCursorBeat = this.anchorBeat;

    this.schedule();
    this.timer = window.setInterval(() => this.schedule(), LOOKAHEAD_MS);
  }

  pause(): void {
    if (!this.playing) return;
    this.pausedBeat = this.getPositionBeat();
    this.playing = false;
    this.clearScheduler();
    this.stopScheduledSources();
  }

  stop(): void {
    this.playing = false;
    this.pausedBeat = 0;
    this.anchorBeat = 0;
    this.scheduleCursorBeat = 0;
    this.clearScheduler();
    this.stopScheduledSources();
    this.stopLiveVoices();
  }

  async seek(beat: number): Promise<void> {
    const loopLength = Math.max(0.001, this.settings.loopLengthBeats);
    const target = modulo(beat, loopLength);
    const wasPlaying = this.playing;

    this.pausedBeat = target;
    if (wasPlaying) {
      this.restartAt(target);
    }
  }

  isPlaying(): boolean {
    return this.playing;
  }

  async noteOn(midi: number, velocity = 0.8, voiceId = String(midi)): Promise<void> {
    const context = await this.ensureContext();
    if (!this.masterGain) return;

    this.noteOff(midi, voiceId);

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = midiToFrequency(midi, this.settings.tuningCents);

    const now = context.currentTime;
    const peakGain = Math.max(0.0002, Math.min(1, velocity) * 0.28);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.012);

    oscillator.connect(gain);
    gain.connect(this.masterGain);
    oscillator.start(now);

    this.liveVoices.set(voiceId, { oscillator, gain });
  }

  noteOff(_midi: number, voiceId = String(_midi)): void {
    const voice = this.liveVoices.get(voiceId);
    if (!voice || !this.context) return;

    const now = this.context.currentTime;
    const stopTime = now + 0.05;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setTargetAtTime(0.0001, now, 0.012);
    try {
      voice.oscillator.stop(stopTime);
    } catch {
      // Voice may already be stopped.
    }
    this.liveVoices.delete(voiceId);
  }

  getPositionBeat(): number {
    const loopLength = Math.max(0.001, this.settings.loopLengthBeats);
    if (!this.playing || !this.context) {
      return modulo(this.pausedBeat, loopLength);
    }

    const elapsedSeconds = Math.max(0, this.context.currentTime - this.anchorContextTime);
    const elapsedBeats = elapsedSeconds * Math.max(1, this.settings.bpm) / 60;
    return modulo(this.anchorBeat + elapsedBeats, loopLength);
  }

  getProgress(): number {
    const loopLength = Math.max(0.001, this.settings.loopLengthBeats);
    return this.getPositionBeat() / loopLength;
  }

  private restartAt(positionBeat: number): void {
    if (!this.context) {
      this.pausedBeat = positionBeat;
      return;
    }

    this.clearScheduler();
    this.stopScheduledSources();

    const loopLength = Math.max(0.001, this.settings.loopLengthBeats);
    this.anchorBeat = modulo(positionBeat, loopLength);
    this.pausedBeat = this.anchorBeat;
    this.anchorContextTime = this.context.currentTime + START_DELAY_SECONDS;
    this.scheduleCursorBeat = this.anchorBeat;

    this.schedule();
    this.timer = window.setInterval(() => this.schedule(), LOOKAHEAD_MS);
  }

  private schedule(): void {
    if (!this.playing || !this.context || !this.masterGain) return;

    const bpm = Math.max(1, this.settings.bpm);
    const beatsPerSecond = bpm / 60;
    const loopLength = Math.max(0.001, this.settings.loopLengthBeats);
    const now = this.context.currentTime;
    const horizonContextTime = now + SCHEDULE_AHEAD_SECONDS;
    const horizonBeat =
      this.anchorBeat + Math.max(0, horizonContextTime - this.anchorContextTime) * beatsPerSecond;

    if (horizonBeat <= this.scheduleCursorBeat) return;

    const startCycle = Math.floor(this.scheduleCursorBeat / loopLength);
    const endCycle = Math.floor(horizonBeat / loopLength);

    for (let cycle = startCycle; cycle <= endCycle; cycle += 1) {
      const cycleBase = cycle * loopLength;

      for (const event of this.events) {
        const absoluteBeat = cycleBase + event.startBeat;
        if (absoluteBeat < this.scheduleCursorBeat - 1e-9 || absoluteBeat >= horizonBeat) continue;
        this.scheduleNote(event, absoluteBeat);
      }
    }

    if (this.settings.metronomeEnabled) {
      const firstBeat = Math.ceil(this.scheduleCursorBeat - 1e-9);
      const lastBeat = Math.floor(horizonBeat - 1e-9);
      for (let absoluteBeat = firstBeat; absoluteBeat <= lastBeat; absoluteBeat += 1) {
        this.scheduleClick(absoluteBeat);
      }
    }

    this.scheduleCursorBeat = horizonBeat;
  }

  private contextTimeForAbsoluteBeat(absoluteBeat: number): number {
    const secondsPerBeat = 60 / Math.max(1, this.settings.bpm);
    return this.anchorContextTime + (absoluteBeat - this.anchorBeat) * secondsPerBeat;
  }

  private scheduleNote(event: NoteEvent, absoluteBeat: number): void {
    if (!this.context || !this.masterGain) return;

    const startTime = this.contextTimeForAbsoluteBeat(absoluteBeat);
    const durationSeconds = Math.max(0.015, event.durationBeats * 60 / Math.max(1, this.settings.bpm));
    const endTime = startTime + durationSeconds;
    if (endTime <= this.context.currentTime) return;

    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = midiToFrequency(event.midi, this.settings.tuningCents);

    const velocity = Math.min(1, Math.max(0, event.velocity));
    const peakGain = 0.26 * velocity;
    const safeStart = Math.max(startTime, this.context.currentTime + 0.001);
    const attackEnd = Math.min(endTime, safeStart + 0.012);
    const releaseStart = Math.max(attackEnd, endTime - 0.045);

    gain.gain.setValueAtTime(0.0001, safeStart);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peakGain), attackEnd);
    gain.gain.setValueAtTime(Math.max(0.0002, peakGain), releaseStart);
    gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

    oscillator.connect(gain);
    gain.connect(this.masterGain);
    oscillator.start(safeStart);
    oscillator.stop(endTime + 0.01);

    this.trackSource(oscillator);
  }

  private scheduleClick(absoluteBeat: number): void {
    if (!this.context || !this.masterGain) return;

    const startTime = this.contextTimeForAbsoluteBeat(absoluteBeat);
    if (startTime < this.context.currentTime - 0.01) return;

    const loopLength = Math.max(0.001, this.settings.loopLengthBeats);
    const localBeat = modulo(absoluteBeat, loopLength);
    const accented = localBeat < 1e-6 || loopLength - localBeat < 1e-6;

    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = accented ? 1320 : 880;

    const safeStart = Math.max(startTime, this.context.currentTime + 0.001);
    const endTime = safeStart + 0.035;
    gain.gain.setValueAtTime(accented ? 0.22 : 0.14, safeStart);
    gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

    oscillator.connect(gain);
    gain.connect(this.masterGain);
    oscillator.start(safeStart);
    oscillator.stop(endTime + 0.005);

    this.trackSource(oscillator);
  }

  private trackSource(source: ScheduledSource): void {
    this.scheduledSources.add(source);
    source.addEventListener('ended', () => this.scheduledSources.delete(source), { once: true });
  }

  private stopScheduledSources(): void {
    for (const source of this.scheduledSources) {
      try {
        source.stop();
      } catch {
        // Source may already have ended.
      }
    }
    this.scheduledSources.clear();
  }

  private stopLiveVoices(): void {
    for (const [voiceId, voice] of this.liveVoices) {
      try {
        voice.oscillator.stop();
      } catch {
        // Voice may already be stopped.
      }
      this.liveVoices.delete(voiceId);
    }
  }

  private clearScheduler(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  async dispose(): Promise<void> {
    this.stop();
    this.stopLiveVoices();
    if (this.context) {
      await this.context.close();
      this.context = null;
      this.masterGain = null;
    }
  }
}
