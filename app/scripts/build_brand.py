#!/usr/bin/env python3
"""Builds the self-hosted logo, icons and Open Graph image from the source logo.

Usage:  python3 scripts/build_brand.py path/to/ff-logo-source.png

Writes (relative to app/):
  public/brand/ff-logo.png, ff-logo@2x.png, ff-logo.webp, ff-logo@2x.webp  (trimmed)
  src/app/icon.png (32x32 favicon), src/app/favicon.ico (16/32/48),
  src/app/apple-icon.png (180x180), src/app/opengraph-image.png (1200x630)
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

NAVY = (11, 20, 38, 255)
GOLD = (201, 151, 58)
ROOT = Path(__file__).resolve().parent.parent
LOGO_H = 168          # 1x height: covers the 84px hero at 2x; 2x covers it at 4x
PAD = 0.12            # icon padding (fraction of side)


def trim(img: Image.Image) -> Image.Image:
    alpha = img.getchannel("A").point(lambda a: 255 if a > 8 else 0)
    box = alpha.getbbox()
    if not box:
        sys.exit("source image is fully transparent")
    return img.crop(box)


def scaled(img: Image.Image, h: int) -> Image.Image:
    return img.resize((max(1, round(img.width * h / img.height)), h), Image.LANCZOS)


def glow(logo: Image.Image, radius: int, strength: float) -> Image.Image:
    """Logo over a soft gold halo, like the old site's drop-shadow(0 0 30px gold)."""
    pad = radius * 2
    canvas = Image.new("RGBA", (logo.width + pad * 2, logo.height + pad * 2), (0, 0, 0, 0))
    halo = Image.new("RGBA", canvas.size, GOLD + (0,))
    mask = Image.new("L", canvas.size, 0)
    mask.paste(logo.getchannel("A"), (pad, pad))
    mask = mask.filter(ImageFilter.GaussianBlur(radius)).point(lambda a: int(a * strength))
    halo.putalpha(mask)
    canvas.alpha_composite(halo)
    canvas.alpha_composite(logo, (pad, pad))
    return canvas


def tile(logo: Image.Image, side: int, rounded: bool) -> Image.Image:
    """Square icon: navy background, logo centred."""
    bg = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    ImageDraw.Draw(bg).rounded_rectangle((0, 0, side - 1, side - 1), radius=side // 5 if rounded else 0, fill=NAVY)
    inner = int(side * (1 - 2 * PAD))
    fit = logo.copy()
    fit.thumbnail((inner, inner), Image.LANCZOS)
    bg.alpha_composite(fit, ((side - fit.width) // 2, (side - fit.height) // 2))
    return bg


def og_image(logo: Image.Image) -> Image.Image:
    w, h = 1200, 630
    img = Image.new("RGBA", (w, h), NAVY)
    # Soft radial gold light behind the logo (matches the home hero).
    light = Image.new("L", (w, h), 0)
    ImageDraw.Draw(light).ellipse((w / 2 - 420, -260, w / 2 + 420, 420), fill=70)
    light = light.filter(ImageFilter.GaussianBlur(120))
    img.alpha_composite(Image.merge("RGBA", (*[Image.new("L", (w, h), c) for c in GOLD], light)))
    mark = glow(scaled(logo, 300), 28, 0.55)
    img.alpha_composite(mark, ((w - mark.width) // 2, 40))
    font = None
    for f in ["/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"]:
        try:
            font = ImageFont.truetype(f, 64)
        except OSError:
            pass
    d = ImageDraw.Draw(img)
    text = "Finally Free Fellowship"
    font = font or ImageFont.load_default()
    tw = d.textlength(text, font=font)
    d.text(((w - tw) / 2, 470), text, font=font, fill=GOLD + (255,))
    return img.convert("RGB")


def main(src: str):
    logo = trim(Image.open(src).convert("RGBA"))
    out = ROOT / "public" / "brand"
    out.mkdir(parents=True, exist_ok=True)
    one, two = scaled(logo, LOGO_H), scaled(logo, LOGO_H * 2)
    one.save(out / "ff-logo.png", optimize=True)
    two.save(out / "ff-logo@2x.png", optimize=True)
    one.save(out / "ff-logo.webp", quality=90, method=6)
    two.save(out / "ff-logo@2x.webp", quality=90, method=6)

    app = ROOT / "src" / "app"
    tile(logo, 32, True).save(app / "icon.png", optimize=True)
    tile(logo, 180, False).save(app / "apple-icon.png", optimize=True)  # iOS rounds the corners itself
    tile(logo, 48, True).save(app / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    og_image(logo).save(app / "opengraph-image.png", optimize=True)
    print(f"trimmed {Image.open(src).size} -> {logo.size}; 1x {one.size}, 2x {two.size}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
