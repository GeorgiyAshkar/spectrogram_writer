import { useEffect, useRef, useState } from 'react';

type AudioPlayerProps = {
  audioUrl: string | null;
  isPreparingAudio: boolean;
  onRequestAudio: () => Promise<void>;
};

export function AudioPlayer({ audioUrl, isPreparingAudio, onRequestAudio }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pendingAutoplay, setPendingAutoplay] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, []);

  useEffect(() => {
    if (!pendingAutoplay || !audioUrl || !audioRef.current) return;
    void audioRef.current.play();
    setPendingAutoplay(false);
  }, [audioUrl, pendingAutoplay]);

  useEffect(() => {
    const audio = audioRef.current;
    const canvas = canvasRef.current;
    if (!audio || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const ac = new AudioContext();
    const src = ac.createMediaElementSource(audio);
    const analyser = ac.createAnalyser();
    analyser.fftSize = 128;
    src.connect(analyser);
    analyser.connect(ac.destination);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;

    const draw = () => {
      analyser.getByteFrequencyData(data);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barW = canvas.width / data.length;
      for (let i = 0; i < data.length; i += 1) {
        const h = (data[i] / 255) * canvas.height;
        ctx.fillStyle = '#b08968';
        ctx.fillRect(i * barW, canvas.height - h, barW - 1, h);
      }
      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(raf);
      src.disconnect();
      analyser.disconnect();
      void ac.close();
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
    if (audio.paused) {
      await audio.play();
    } else {
      audio.pause();
    }
  };

  return (
    <div className="header-player">
      <button type="button" className="button-secondary panel-tab panel-tab--icon" onClick={() => void togglePlay()} disabled={isPreparingAudio} title="Воспроизвести/Пауза" aria-label="Воспроизвести/Пауза">
        <span aria-hidden="true">{isPlaying ? '⏸️' : '▶️'}</span>
      </button>
      <canvas ref={canvasRef} className="header-waveform" width={220} height={44} />
      <audio ref={audioRef} src={audioUrl ?? undefined} preload="metadata" />
    </div>
  );
}
