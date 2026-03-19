export type Orientation = 'time-x' | 'freq-x';
export type Rotation = 'ccw' | 'cw';
export type TimbreMode = 'pure' | 'harmonic' | 'sample_masked';
export type InstrumentType = 'piano' | 'guitar' | 'synth' | 'custom';
export type HarmonicDecayMode = '1/n' | '1/n^2' | 'custom_list';

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
  freq_x_marquee: boolean;
  freq_x_word_rows: boolean;
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
  timbre_mode: TimbreMode;
  instrument_type: InstrumentType;
  num_harmonics: number;
  harmonic_decay_mode: HarmonicDecayMode;
  harmonic_weights: number[] | null;
  adsr_attack: number;
  adsr_decay: number;
  adsr_sustain: number;
  adsr_release: number;
  sample_masked: boolean;
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
