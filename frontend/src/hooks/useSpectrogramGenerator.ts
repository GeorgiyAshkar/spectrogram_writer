import { useEffect, useMemo, useRef, useState } from 'react';
import { downloadWav, fetchPreview, resolveLogoUrl } from '../services/api';
import type { GenerationFormData, PreviewResponse } from '../types/config';

const PREVIEW_DEBOUNCE_MS = 450;

export function useSpectrogramGenerator(formData: GenerationFormData) {
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const previewRequestId = useRef(0);

  const summary = useMemo(
    () => [
      { label: 'Диапазон частот', value: `${formData.fmin}–${formData.fmax} Гц` },
      { label: 'Длительность сигнала', value: `${formData.signal_duration} c` },
      { label: 'Частота дискретизации', value: `${formData.samplerate} Гц` },
      { label: 'Ориентация', value: formData.orientation === 'time-x' ? 'Время по X' : 'Частота по X' },
      { label: 'Режим тембра', value: formData.timbre_mode === 'pure' ? 'Pure' : formData.timbre_mode === 'harmonic' ? `Harmonic · ${formData.instrument_type}` : 'Sample masked' },
    ],
    [formData],
  );

  useEffect(() => {
    let isMounted = true;

    void resolveLogoUrl().then((url) => {
      if (isMounted) {
        setLogoUrl(url);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const requestId = ++previewRequestId.current;
    setIsLoadingPreview(true);
    setError(null);

    const timeoutId = window.setTimeout(async () => {
      try {
        const nextPreview = await fetchPreview(formData);
        if (previewRequestId.current === requestId) {
          setPreview(nextPreview);
        }
      } catch (err) {
        if (previewRequestId.current === requestId) {
          setError(err instanceof Error ? err.message : 'Не удалось обновить предпросмотр');
        }
      } finally {
        if (previewRequestId.current === requestId) {
          setIsLoadingPreview(false);
        }
      }
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [formData]);

  const exportWav = async () => {
    setIsDownloading(true);
    setError(null);
    try {
      const blob = await downloadWav(formData);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'spectrogram.wav';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось скачать WAV');
    } finally {
      setIsDownloading(false);
    }
  };

  return { preview, error, summary, logoUrl, isLoadingPreview, isDownloading, exportWav };
}
