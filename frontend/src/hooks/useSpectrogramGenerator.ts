import { useMemo, useState } from 'react';
import { downloadWav, fetchPreview } from '../services/api';
import type { GenerationFormData, PreviewResponse } from '../types/config';

export function useSpectrogramGenerator(formData: GenerationFormData) {
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const summary = useMemo(
    () => [
      { label: 'Frequency range', value: `${formData.fmin}–${formData.fmax} Hz` },
      { label: 'Signal duration', value: `${formData.signal_duration}s` },
      { label: 'Sample rate', value: `${formData.samplerate} Hz` },
      { label: 'Orientation', value: formData.orientation },
    ],
    [formData],
  );

  const generatePreview = async () => {
    setIsLoadingPreview(true);
    setError(null);
    try {
      setPreview(await fetchPreview(formData));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview generation failed');
    } finally {
      setIsLoadingPreview(false);
    }
  };

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
      setError(err instanceof Error ? err.message : 'Audio export failed');
    } finally {
      setIsDownloading(false);
    }
  };

  return { preview, error, summary, isLoadingPreview, isDownloading, generatePreview, exportWav };
}
