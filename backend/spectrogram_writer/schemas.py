from pydantic import BaseModel, Field


class GenerationRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=20000)
    fmin: float = 2000
    fmax: float = 12000
    signal_duration: float = 10
    leading_silence: float = 0
    trailing_silence: float = 0
    samplerate: int = 48000
    output: str | None = None
    preview_png: str | None = None
    orientation: str = "time-x"
    freq_x_rotation: str = "ccw"
    freq_x_marquee: bool = False
    freq_x_word_rows: bool = False
    edge_pad_cols: int = -1
    img_width: int = 1000
    img_height: int = 160
    font_size: int = 180
    font_path: str | None = None
    margin: int = 12
    vertical_margin: int = 8
    smooth_freq: int = 5
    smooth_sigma: float = 1.0
    contrast: float = 1.0
    invert: bool = False
    fixed_phase: bool = False
    timbre_mode: str = "pure"
    instrument_type: str = "piano"
    num_harmonics: int = 5
    harmonic_decay_mode: str = "1/n"
    harmonic_weights: list[float] | None = None
    adsr_attack: float = 0.02
    adsr_decay: float = 0.08
    adsr_sustain: float = 0.9
    adsr_release: float = 0.05
    sample_masked: bool = False
