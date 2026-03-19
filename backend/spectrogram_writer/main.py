from __future__ import annotations

import argparse
from pathlib import Path

from .core import GenerationConfig, generate_artifacts


def build_parser() -> argparse.ArgumentParser:
    """Create CLI parser for spectrogram writer."""
    parser = argparse.ArgumentParser(description="Генератор WAV для текста/графики на spectrogram waterfall.")
    parser.add_argument("--text", required=True)
    parser.add_argument("--fmin", type=float, required=True)
    parser.add_argument("--fmax", type=float, required=True)
    parser.add_argument("--signal-duration", type=float, required=True)
    parser.add_argument("--leading-silence", type=float, default=0.0)
    parser.add_argument("--trailing-silence", type=float, default=0.0)
    parser.add_argument("--samplerate", type=int, default=48_000)
    parser.add_argument("--output", required=True)
    parser.add_argument("--preview-png")
    parser.add_argument("--img-width", type=int, default=1000)
    parser.add_argument("--img-height", type=int, default=160)
    parser.add_argument("--font-size", type=int, default=180)
    parser.add_argument("--font-path")
    parser.add_argument("--margin", type=int, default=12)
    parser.add_argument("--vertical-margin", type=int, default=8)
    parser.add_argument("--invert", action="store_true")
    parser.add_argument("--orientation", choices=["time-x", "freq-x"], default="time-x")
    parser.add_argument("--freq-x-rotation", choices=["ccw", "cw"], default="ccw")
    parser.add_argument("--edge-pad-cols", type=int, default=-1)
    parser.add_argument("--smooth-freq", type=int, default=5)
    parser.add_argument("--smooth-sigma", type=float, default=1.0)
    parser.add_argument("--contrast", type=float, default=1.0)
    parser.add_argument("--fixed-phase", action="store_true")
    parser.add_argument("--timbre-mode", choices=["pure", "harmonic", "sample_masked"], default="pure")
    parser.add_argument("--instrument-type", choices=["piano", "guitar", "synth", "custom"], default="piano")
    parser.add_argument("--num-harmonics", type=int, default=5)
    parser.add_argument("--harmonic-decay-mode", choices=["1/n", "1/n^2", "custom_list"], default="1/n")
    parser.add_argument("--harmonic-weights", nargs="*", type=float)
    parser.add_argument("--adsr-attack", type=float, default=0.02)
    parser.add_argument("--adsr-decay", type=float, default=0.08)
    parser.add_argument("--adsr-sustain", type=float, default=0.9)
    parser.add_argument("--adsr-release", type=float, default=0.05)
    return parser


def main() -> int:
    """Run CLI generation pipeline and save artifacts to disk."""
    args = build_parser().parse_args()
    config = GenerationConfig(
        text=args.text,
        fmin=args.fmin,
        fmax=args.fmax,
        signal_duration=args.signal_duration,
        leading_silence=args.leading_silence,
        trailing_silence=args.trailing_silence,
        samplerate=args.samplerate,
        output=args.output,
        preview_png=args.preview_png,
        img_width=args.img_width,
        img_height=args.img_height,
        font_size=args.font_size,
        font_path=args.font_path,
        margin=args.margin,
        vertical_margin=args.vertical_margin,
        invert=args.invert,
        orientation=args.orientation,
        freq_x_rotation=args.freq_x_rotation,
        edge_pad_cols=args.edge_pad_cols,
        smooth_freq=args.smooth_freq,
        smooth_sigma=args.smooth_sigma,
        contrast=args.contrast,
        fixed_phase=args.fixed_phase,
        timbre_mode=args.timbre_mode,
        instrument_type=args.instrument_type,
        num_harmonics=args.num_harmonics,
        harmonic_decay_mode=args.harmonic_decay_mode,
        harmonic_weights=args.harmonic_weights,
        adsr_attack=args.adsr_attack,
        adsr_decay=args.adsr_decay,
        adsr_sustain=args.adsr_sustain,
        adsr_release=args.adsr_release,
    )
    artifacts = generate_artifacts(config)
    Path(args.output).write_bytes(artifacts.wav_bytes)
    if args.preview_png:
        Path(args.preview_png).write_bytes(artifacts.preview_png)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
