import { useEffect, useMemo, useRef, useState } from 'react';

type AudioPlayerProps = {
  audioUrl: string | null;
  isPreparingAudio: boolean;
  onRequestAudio: () => Promise<void>;
  onToggleEraser: () => void;
  eraserEnabled: boolean;
  onClearCanvas: () => void;
};

const WAVE_SAMPLES = 220;

export function AudioPlayer({ audioUrl, isPreparingAudio, onRequestAudio, onToggleEraser, eraserEnabled, onClearCanvas }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pendingAutoplay, setPendingAutoplay] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [playIcon, setPlayIcon] = useState('/icons/play.svg');

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTime = () => setPosition(audio.currentTime);
    const onMeta = () => setDuration(audio.duration || 0);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
    };
  }, []);

  useEffect(() => {
    if (!pendingAutoplay || !audioUrl || !audioRef.current) return;
    void audioRef.current.play();
    setPendingAutoplay(false);
  }, [audioUrl, pendingAutoplay]);


  useEffect(() => {
    if (!audioRef.current || audioUrl) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsPlaying(false);
    setPosition(0);
  }, [audioUrl]);

  useEffect(() => {
    let cancelled = false;
    if (!audioUrl) {
      setPeaks([]);
      setDuration(0);
      setPosition(0);
      return;
    }

    const buildWaveform = async () => {
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      const channel = audioBuffer.getChannelData(0);
      const block = Math.floor(channel.length / WAVE_SAMPLES) || 1;
      const nextPeaks = new Array(WAVE_SAMPLES).fill(0).map((_, i) => {
        let max = 0;
        const start = i * block;
        const end = Math.min(start + block, channel.length);
        for (let j = start; j < end; j += 1) {
          const v = Math.abs(channel[j]);
          if (v > max) max = v;
        }
        return max;
      });
      await audioContext.close();
      if (!cancelled) setPeaks(nextPeaks);
    };

    void buildWaveform();
    return () => {
      cancelled = true;
    };
  }, [audioUrl]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audioUrl) {
      setPendingAutoplay(true);
      await onRequestAudio();
      return;
    }
    if (audio.paused) await audio.play();
    else audio.pause();
  };

  useEffect(() => {
    void fetch('/icon_config.json')
      .then((response) => response.json())
      .then((config) => setPlayIcon(config.play ?? '/icons/play.svg'))
      .catch(() => setPlayIcon('/icons/play.svg'));
  }, []);

  const progress = useMemo(() => (duration > 0 ? (position / duration) * 100 : 0), [duration, position]);

  const downloadWav = () => {
    if (!audioUrl) return;
    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = 'spectrogram.wav';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="header-player">
      <button type="button" className="button-secondary panel-tab panel-tab--icon header-player__play" onClick={() => void togglePlay()} disabled={isPreparingAudio} title="Воспроизвести/Пауза" aria-label="Воспроизвести/Пауза">
        {isPlaying ? <span className="header-player__play-icon" aria-hidden="true">⏸️</span> : <img src={playIcon} alt="" aria-hidden="true" className="header-player__play-icon-image" />}
      </button>

      <div className="waveform-block">
        <div className="waveform">
          <div className="waveform__bars" aria-hidden="true">
            {peaks.map((peak, index) => (
              <span key={`${index}`} className="waveform__bar" style={{ height: `${Math.max(6, peak * 100)}%` }} />
            ))}
            <div className="waveform__progress" style={{ width: `${progress}%` }} />
          </div>
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.01}
            value={position}
            onChange={(e) => {
              const next = Number(e.target.value);
              setPosition(next);
              if (audioRef.current) audioRef.current.currentTime = next;
            }}
            className="waveform-slider"
          />
        </div>
      </div>

      <button
        type="button"
        className="button-secondary draw-panel__clear-btn header-player__download"
        onClick={downloadWav}
        disabled={!audioUrl || isPreparingAudio}
      >
        Скачать WAV
      </button>


      <button
        type="button"
        className="button-secondary draw-panel__clear-btn header-player__eraser"
        onClick={onToggleEraser}
        aria-pressed={eraserEnabled}
      >
        {eraserEnabled ? 'Ластик: ВКЛ' : 'Ластик'}
      </button>
      <button
        type="button"
        className="button-secondary draw-panel__clear-btn header-player__clear"
        onClick={onClearCanvas}
      >
        Очистить холст
      </button>

      <audio ref={audioRef} src={audioUrl ?? undefined} preload="metadata" />
    </div>
  );
}
