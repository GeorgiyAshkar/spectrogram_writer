from pydantic import BaseModel, Field


class GenerationRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=120)
    fmin: float = 2000
    fmax: float = 12000
    signal_duration: float = 10
    leading_silence: float = 0
    trailing_silence: float = 0
    samplerate: int = 48000
    orientation: str = "time-x"
    freq_x_rotation: str = "ccw"
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
