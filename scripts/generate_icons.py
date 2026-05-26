"""
Generate Pulse PWA icons.

The brand mark is an ambient "flux" glyph: a deep void field with a soft
aurora radial glow, three concentric pulse arcs (the signal motif from the
app's FluxOrb), and a bright core. Rendered at high supersample then
downscaled for crisp antialiasing. Produces standard + maskable variants.
"""
import math
from PIL import Image, ImageDraw, ImageFilter

VOID = (5, 6, 10)
CYAN = (94, 231, 224)
ICE = (124, 198, 255)
VIOLET = (157, 140, 255)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def radial_glow(size, center, radius, color, max_alpha):
    """Return an RGBA layer with a soft radial glow."""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = layer.load()
    cx, cy = center
    for y in range(size):
        for x in range(size):
            d = math.hypot(x - cx, y - cy)
            if d < radius:
                t = 1 - (d / radius)
                a = int(max_alpha * (t ** 2.2))
                if a > 0:
                    px[x, y] = (*color, a)
    return layer


def make_icon(size, maskable=False):
    SS = 4  # supersample factor
    S = size * SS
    img = Image.new("RGBA", (S, S), (*VOID, 255))

    cx = cy = S / 2
    # On maskable icons keep the mark within the safe ~80% zone.
    scale = 0.62 if maskable else 0.78
    R = (S / 2) * scale

    # --- ambient background gradient wash ---
    bg = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    bpx = bg.load()
    for y in range(S):
        for x in range(S):
            d = math.hypot(x - cx, y - cy) / (S / 2)
            d = min(d, 1.0)
            # blend violet (edges) -> void
            col = lerp((14, 16, 28), VOID, d)
            bpx[x, y] = (*col, 255)
    img = Image.alpha_composite(img, bg)

    # --- soft aurora core glow ---
    glow = radial_glow(S, (cx, cy), R * 1.15, CYAN, 90)
    glow = glow.filter(ImageFilter.GaussianBlur(S * 0.02))
    img = Image.alpha_composite(img, glow)

    glow2 = radial_glow(S, (cx - R * 0.18, cy - R * 0.12), R * 0.7, ICE, 70)
    glow2 = glow2.filter(ImageFilter.GaussianBlur(S * 0.02))
    img = Image.alpha_composite(img, glow2)

    # --- concentric pulse arcs ---
    arcs = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ad = ImageDraw.Draw(arcs)
    lw = max(2, int(S * 0.022))
    rings = [
        (R * 0.92, 200, -210, -30, ICE),
        (R * 0.66, 230, 20, 200, VIOLET),
        (R * 0.40, 255, -160, 10, CYAN),
    ]
    for rad, alpha, a0, a1, col in rings:
        bbox = [cx - rad, cy - rad, cx + rad, cy + rad]
        ad.arc(bbox, a0, a1, fill=(*col, alpha), width=lw)
    arcs = arcs.filter(ImageFilter.GaussianBlur(S * 0.004))
    img = Image.alpha_composite(img, arcs)

    # --- bright core dot with glow ---
    core_glow = radial_glow(S, (cx, cy), R * 0.34, (220, 255, 252), 200)
    core_glow = core_glow.filter(ImageFilter.GaussianBlur(S * 0.012))
    img = Image.alpha_composite(img, core_glow)

    core = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    cd = ImageDraw.Draw(core)
    cr = R * 0.12
    cd.ellipse([cx - cr, cy - cr, cx + cr, cy + cr], fill=(235, 255, 253, 255))
    img = Image.alpha_composite(img, core)

    # downscale for antialiasing
    img = img.resize((size, size), Image.LANCZOS)

    # rounded corners for non-maskable (nice on desktop installs)
    if not maskable:
        radius = int(size * 0.22)
        mask = Image.new("L", (size, size), 0)
        md = ImageDraw.Draw(mask)
        md.rounded_rectangle([0, 0, size, size], radius=radius, fill=255)
        out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        out.paste(img, (0, 0), mask)
        img = out

    return img.convert("RGBA")


def main():
    out = "public/icons"
    make_icon(192).save(f"{out}/icon-192.png")
    make_icon(512).save(f"{out}/icon-512.png")
    make_icon(512, maskable=True).save(f"{out}/icon-maskable-512.png")
    # Apple touch icon + favicon sizes for completeness
    make_icon(180).save(f"{out}/apple-touch-icon.png")
    make_icon(32).save(f"{out}/favicon-32.png")
    make_icon(16).save(f"{out}/favicon-16.png")
    print("icons generated")


if __name__ == "__main__":
    main()
