"""Draw the Life Replay logo as PNGs.

The mark is two offset rounded squares — frames stacked the way a reel of them
would be — in the primary and the accent, exactly as the app draws it in views.
This renders the same geometry to files, so the icon, the store listing and the
running app are the same mark rather than three near-misses.

    python scripts/make_logo.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parents[1] / "assets" / "brand"

PRIMARY = (107, 78, 230, 255)      # #6B4EE6
ACCENT = (240, 86, 45, 230)        # #F0562D at the 0.9 opacity the app uses
INK = (22, 18, 31, 255)            # #16121F
WHITE = (255, 255, 255, 255)

# Windows has no Roboto; Segoe UI Bold is the closest grotesque to what the app
# renders in, and the wordmark is set in the system face by design.
FONT_PATH = r"C:\Windows\Fonts\segoeuib.ttf"


def draw_mark(draw, x, y, unit, shadow=False):
    """Two squares, the second offset up and right by half a unit."""
    radius = int(unit * 0.32)
    back = (x, y + unit // 2, x + unit, y + unit + unit // 2)
    front = (x + unit // 2, y, x + unit + unit // 2, y + unit)

    if shadow:
        # A soft seat under the mark so it holds on a white page.
        draw.rounded_rectangle(
            (back[0] + 2, back[1] + 3, back[2] + 2, back[3] + 3),
            radius=radius,
            fill=(34, 26, 56, 28),
        )

    draw.rounded_rectangle(back, radius=radius, fill=PRIMARY)
    draw.rounded_rectangle(front, radius=radius, fill=ACCENT)


def mark_only(size: int, path: Path, background=None, pad_ratio=0.22):
    image = Image.new("RGBA", (size, size), background or (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    pad = int(size * pad_ratio)
    unit = int((size - pad * 2) / 1.5)
    total_w = unit + unit // 2
    total_h = unit + unit // 2
    draw_mark(draw, (size - total_w) // 2, (size - total_h) // 2, unit)

    image.save(path)
    return path


def wordmark(path: Path, height=320, on_dark=False):
    """Mark plus the name, set the way the app sets it."""
    unit = int(height * 0.36)
    font_size = int(height * 0.42)
    font = ImageFont.truetype(FONT_PATH, font_size)

    gap = int(unit * 0.55)
    mark_w = unit + unit // 2
    ink = WHITE if on_dark else INK

    probe = Image.new("RGBA", (10, 10))
    measure = ImageDraw.Draw(probe)
    life_w = measure.textlength("Life", font=font)
    replay_w = measure.textlength("Replay", font=font)

    width = int(mark_w + gap + life_w + replay_w + height * 0.2)
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    mark_y = (height - (unit + unit // 2)) // 2
    draw_mark(draw, int(height * 0.1), mark_y, unit)

    # "Life" in the ink colour, "Replay" in the primary — the same split the app
    # renders, so the two never drift apart.
    text_x = int(height * 0.1) + mark_w + gap
    text_y = (height - font_size) // 2 - int(font_size * 0.12)
    draw.text((text_x, text_y), "Life", font=font, fill=ink)
    draw.text((text_x + life_w, text_y), "Replay", font=font, fill=PRIMARY[:3] + (255,))

    image.save(path)
    return path


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    made = []

    # The mark alone, transparent, at the sizes stores and manifests ask for.
    for size in (1024, 512, 256, 128, 64):
        made.append(mark_only(size, OUT / f"mark-{size}.png"))

    # On white, for anywhere transparency is not supported.
    made.append(mark_only(1024, OUT / "mark-1024-white.png", background=WHITE))

    # Padded less and on white: what an app icon wants, since the OS crops it.
    made.append(mark_only(1024, OUT / "icon-1024.png", background=WHITE, pad_ratio=0.18))

    made.append(wordmark(OUT / "wordmark.png", height=320))
    made.append(wordmark(OUT / "wordmark@2x.png", height=640))
    made.append(wordmark(OUT / "wordmark-on-dark.png", height=320, on_dark=True))

    for path in made:
        image = Image.open(path)
        print(f"  {path.name:<26} {image.size[0]}x{image.size[1]}")
    print(f"\n{len(made)} files in {OUT}")


if __name__ == "__main__":
    main()
