import { useCallback, useEffect, useRef, useState } from 'react';
import type { MusicSettings, NoteEvent } from '../model/types';
import { RealtimeMusicTransport } from './RealtimeMusicTransport';

export function useRealtimeMusicTransport(
  events: readonly NoteEvent[],
  settings: MusicSettings,
) {
  const transportRef = useRef<RealtimeMusicTransport | null>(null);
  const frameRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionBeat, setPositionBeat] = useState(0);

  if (!transportRef.current) {
    transportRef.current = new RealtimeMusicTransport(settings);
  }

  useEffect(() => {
    const transport = transportRef.current;
    if (!transport) return;
    transport.setProject(events, settings);
    setPositionBeat(transport.getPositionBeat());
  }, [events, settings]);

  useEffect(() => {
    if (!isPlaying) {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      return;
    }

    let active = true;
    const tick = () => {
      if (!active) return;
      const transport = transportRef.current;
      if (transport) setPositionBeat(transport.getPositionBeat());
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      active = false;
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [isPlaying]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      const transport = transportRef.current;
      if (transport) void transport.dispose();
    },
    [],
  );

  const togglePlayback = useCallback(async () => {
    const transport = transportRef.current;
    if (!transport) return;

    if (transport.isPlaying()) {
      transport.pause();
      setIsPlaying(false);
      setPositionBeat(transport.getPositionBeat());
      return;
    }

    if (events.length === 0 && !settings.metronomeEnabled) return;
    await transport.play();
    setIsPlaying(true);
  }, [events.length, settings.metronomeEnabled]);

  const stop = useCallback(() => {
    const transport = transportRef.current;
    if (!transport) return;
    transport.stop();
    setIsPlaying(false);
    setPositionBeat(0);
  }, []);

  const seek = useCallback(async (beat: number) => {
    const transport = transportRef.current;
    if (!transport) return;
    await transport.seek(beat);
    setPositionBeat(transport.getPositionBeat());
  }, []);

  const getPositionBeat = useCallback(
    () => transportRef.current?.getPositionBeat() ?? 0,
    [],
  );

  const noteOn = useCallback(
    async (
      midi: number,
      velocity = 0.8,
      voiceId = String(midi),
      layerId = 'default',
    ) => {
      await transportRef.current?.noteOn(midi, velocity, voiceId, layerId);
    },
    [],
  );

  const noteOff = useCallback(
    (midi: number, voiceId = String(midi)) => {
      transportRef.current?.noteOff(midi, voiceId);
    },
    [],
  );

  const releaseLiveNotes = useCallback(() => {
    transportRef.current?.releaseLiveNotes();
  }, []);

  const getCaptureStream = useCallback(async () => {
    const transport = transportRef.current;
    if (!transport) throw new Error('Music transport is unavailable.');
    return transport.getCaptureStream();
  }, []);

  return {
    isPlaying,
    positionBeat,
    progress: settings.loopLengthBeats > 0 ? positionBeat / settings.loopLengthBeats : 0,
    togglePlayback,
    stop,
    seek,
    getPositionBeat,
    noteOn,
    noteOff,
    releaseLiveNotes,
    getCaptureStream,
  };
}
