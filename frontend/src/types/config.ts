export type Orientation = 'time-x' | 'freq-x';
export type Rotation = 'ccw' | 'cw';

export interface GenerationFormData {
  text: string;
  fmin: number;
  fmax: number;
  signal_duration: number;
  leading_silence: number;
  trailing_silence: number;
  samplerate: number;
  orientation: Orientation;
  freq_x_rotation: Rotation;
  edge_pad_cols: number;
  img_width: number;
  img_height: number;
  font_size: number;
  margin: number;
  vertical_margin: number;
  smooth_freq: number;
  smooth_sigma: number;
  contrast: number;
  invert: boolean;
  fixed_phase: boolean;
}

export interface PreviewResponse {
  previewImage: string;
  autoEdgePad: number;
  totalDuration: number;
  bitmapShape: {
    freqBins: number;
    timeBins: number;
  };
}
