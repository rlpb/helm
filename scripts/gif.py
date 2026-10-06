"""Builds docs/demo.gif: the feature cards, one after another, with a short crossfade.

    python scripts/gif.py docs/demo.gif docs/feature-band.png docs/feature-project.png ...

Needs Pillow (`pip install pillow`). Used only to regenerate the demo; the mod itself has no Python.
"""

import sys

from PIL import Image

WIDTH = 960
HOLD_MS = 2600
FADE_STEPS = 6
FADE_MS = 70


def load(path: str) -> Image.Image:
    image = Image.open(path).convert("RGB")
    return image.resize((WIDTH, round(image.height * WIDTH / image.width)), Image.LANCZOS)


def main() -> None:
    out, *paths = sys.argv[1:]
    cards = [load(p) for p in paths]
    frames, durations = [], []
    for i, card in enumerate(cards):
        frames.append(card)
        durations.append(HOLD_MS)
        following = cards[(i + 1) % len(cards)]
        for step in range(1, FADE_STEPS):
            frames.append(Image.blend(card, following, step / FADE_STEPS))
            durations.append(FADE_MS)
    palette = [f.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE) for f in frames]
    palette[0].save(out, save_all=True, append_images=palette[1:], duration=durations, loop=0, optimize=True, disposal=2)
    print(f"{out}  {WIDTH}x{cards[0].height}, {len(frames)} frames")


main()
