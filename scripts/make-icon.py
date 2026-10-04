#!/usr/bin/env python3
"""Generate the JJK Mod Editor icon set (master PNG -> ICO + favicons).

Design: dark cursed-energy rounded square, red torii mark on top,
bold white "JJK" slashed by a crimson cursed-energy claw,
"MOD EDITOR" micro-caption underneath.
"""
import math
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
BUILD = os.path.join(ROOT, "build")
FRONT_PUBLIC = os.path.join(ROOT, "frontend", "public")
RENDERER = os.path.join(ROOT, "renderer")

SIZE = 1024

def font_bold(px):
    cands = [
        r"C:\Windows\Fonts\impact.ttf",
        r"C:\Windows\Fonts\arialbd.ttf",
        r"C:\Windows\Fonts\segoeuib.ttf",
    ]
    for p in cands:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, px)
            except Exception:
                continue
    return ImageFont.load_default()

def font_condensed(px):
    # Impact for the big JJK letters if present, else Arial Black-ish bold
    return font_bold(px)

def font_micro(px):
    for p in (r"C:\Windows\Fonts\segoeuib.ttf", r"C:\Windows\Fonts\arialbd.ttf"):
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, px)
            except Exception:
                continue
    return ImageFont.load_default()

def rounded_mask(size, radius):
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return m

def clip_alpha(layer, mask):
    """Intersect a layer's alpha with the rounded-corner mask (keep RGB)."""
    a = layer.split()[3]
    blank = Image.new("L", layer.size, 0)
    layer.putalpha(Image.composite(a, blank, mask))
    return layer

def gradient_bg(size):
    top = (46, 18, 44)     # dark plum
    mid = (20, 16, 31)
    bot = (11, 13, 20)     # near-black navy
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        t = y / (size - 1)
        if t < 0.45:
            k = t / 0.45
            c = tuple(int(top[i] + (mid[i] - top[i]) * k) for i in range(3))
        else:
            k = (t - 0.45) / 0.55
            c = tuple(int(mid[i] + (bot[i] - mid[i]) * k) for i in range(3))
        for x in range(size):
            px[x, y] = c
    # radial vignette: darken corners slightly (keep center near-full brightness)
    vig = Image.new("L", (size, size), 0)
    vd = ImageDraw.Draw(vig)
    vd.ellipse([-size * 0.25, -size * 0.25, size * 1.25, size * 1.25], fill=255)
    vig = vig.filter(ImageFilter.GaussianBlur(size // 8))
    black = Image.new("RGB", (size, size), (4, 5, 9))
    img = Image.composite(img, black, vig.point(lambda v: 200 + v * 55 // 255))
    return img

def draw_torii(draw, cx, y_top, w, h, color, width):
    # simplified torii: curved top lintel + second beam + 2 pillars + center plaque
    x0, x1 = cx - w / 2, cx + w / 2
    # top lintel with slight upward curve
    draw.line([x0, y_top, x1, y_top], fill=color, width=width, joint="curve")
    draw.line([x0 + w * 0.08, y_top + h * 0.22, x1 - w * 0.08, y_top + h * 0.22],
              fill=color, width=max(2, width * 2 // 3), joint="curve")
    # pillars (slightly tilted inward)
    draw.line([x0 + w * 0.16, y_top, x0 + w * 0.20, y_top + h], fill=color, width=width, joint="curve")
    draw.line([x1 - w * 0.16, y_top, x1 - w * 0.20, y_top + h], fill=color, width=width, joint="curve")
    # center plaque
    pw = max(3, width // 2)
    draw.line([cx, y_top, cx, y_top + h * 0.55], fill=color, width=pw)

def text_center(draw, cx, y, text, font, fill, stroke_w=0, stroke_fill=None, tracking=0):
    # manual letter tracking
    widths = []
    for ch in text:
        bb = draw.textbbox((0, 0), ch, font=font, stroke_width=stroke_w)
        widths.append(bb[2] - bb[0])
    total = sum(widths) + tracking * (len(text) - 1)
    x = cx - total / 2
    for ch, w in zip(text, widths):
        draw.text((x, y), ch, font=font, fill=fill,
                  stroke_width=stroke_w, stroke_fill=stroke_fill)
        x += w + tracking
    return total

def build_master(size=1024):
    img = gradient_bg(size).convert("RGBA")
    d = ImageDraw.Draw(img, "RGBA")
    u = size / 1024.0
    corner = int(228 * u)
    mask = rounded_mask(size, corner)
    # safe-area helper: everything stays well inside the rounded mask
    safe = int(64 * u)

    # --- outer red rim (fully inside the mask) ---
    rim_w = int(16 * u)
    inset = safe // 2  # 32px: rim outer edge sits inside the mask curve
    d.rounded_rectangle([inset, inset, size - 1 - inset, size - 1 - inset],
                        radius=corner - inset, outline=(255, 45, 63, 255), width=rim_w)
    # faint inner highlight
    hi = inset + rim_w + int(12 * u)
    d.rounded_rectangle([hi, hi, size - 1 - hi, size - 1 - hi],
                        radius=corner - hi, outline=(255, 110, 110, 55), width=int(3 * u))

    # --- torii mark (red) ---
    torii_c = (255, 61, 76)
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    draw_torii(gd, size / 2, int(165 * u), int(280 * u), int(135 * u), torii_c + (255,), int(24 * u))
    glow = glow.filter(ImageFilter.GaussianBlur(int(14 * u)))
    clip_alpha(glow, mask)
    img = Image.alpha_composite(img, glow)
    d = ImageDraw.Draw(img, "RGBA")
    draw_torii(d, size / 2, int(165 * u), int(280 * u), int(135 * u), torii_c + (255,), int(20 * u))

    # --- JJK letters ---
    f_big = font_condensed(int(400 * u))
    sh = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    text_center(sd, size / 2, int(310 * u), "JJK", f_big,
                fill=(0, 0, 0, 200), stroke_w=int(8 * u), stroke_fill=(0, 0, 0, 200),
                tracking=int(10 * u))
    sh = sh.filter(ImageFilter.GaussianBlur(int(10 * u)))
    img = Image.alpha_composite(img, sh)
    d = ImageDraw.Draw(img, "RGBA")
    text_center(d, size / 2, int(310 * u), "JJK", f_big,
                fill=(245, 242, 235, 255), stroke_w=int(5 * u), stroke_fill=(20, 8, 12, 255),
                tracking=int(10 * u))

    # --- cursed-energy claw slash (kept inside safe area, masked) ---
    def slash_layer(draw_obj, offset, w, color):
        x0 = int(215 * u + offset)
        y1 = int(800 * u)
        x1 = int(810 * u + offset)
        y0 = int(265 * u)
        draw_obj.polygon([(x0 - w, y1), (x0 + w, y1), (x1 + w, y0), (x1 - w, y0)], fill=color)
    slash_glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sg = ImageDraw.Draw(slash_glow)
    slash_layer(sg, 0, int(26 * u), (255, 45, 70, 200))
    slash_layer(sg, -int(80 * u), int(9 * u), (255, 45, 70, 200))
    slash_layer(sg, int(80 * u), int(9 * u), (178, 102, 255, 200))
    slash_glow = slash_glow.filter(ImageFilter.GaussianBlur(int(16 * u)))
    clip_alpha(slash_glow, mask)
    img = Image.alpha_composite(img, slash_glow)
    sl = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sld = ImageDraw.Draw(sl)
    slash_layer(sld, 0, int(17 * u), (255, 70, 85, 255))
    slash_layer(sld, 0, int(6 * u), (255, 228, 232, 255))  # hot core
    slash_layer(sld, -int(80 * u), int(5 * u), (255, 70, 85, 230))
    slash_layer(sld, int(80 * u), int(5 * u), (196, 130, 255, 230))
    clip_alpha(sl, mask)
    img = Image.alpha_composite(img, sl)
    d = ImageDraw.Draw(img, "RGBA")

    # --- micro caption (drawn after slash so the pill edge stays crisp) ---
    f_micro = font_micro(int(60 * u))
    cap = "MOD EDITOR"
    bb = d.textbbox((0, 0), cap, font=f_micro)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    pad_x, pad_y = int(32 * u), int(20 * u)
    pill = [size / 2 - tw / 2 - pad_x, int(795 * u),
            size / 2 + tw / 2 + pad_x, int(795 * u) + th + pad_y * 2]
    d.rounded_rectangle(pill, radius=int(26 * u), fill=(5, 5, 10, 200))
    d.rounded_rectangle(pill, radius=int(26 * u), outline=(255, 70, 85, 90), width=int(2 * u))
    d.text((size / 2 - tw / 2, int(795 * u) + pad_y - int(10 * u)), cap,
           font=f_micro, fill=(255, 205, 210, 255))

    # --- smooth top gloss (vertical fade, no hard edge) ---
    gloss_h = int(size * 0.42)
    sheen = Image.new("L", (1, gloss_h))
    for y in range(gloss_h):
        sheen.putpixel((0, y), int(30 * (1 - y / gloss_h)))
    sheen = sheen.resize((size, gloss_h))
    white = Image.new("RGBA", (size, gloss_h), (255, 255, 255, 255))
    white.putalpha(sheen)
    gloss = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gloss.alpha_composite(white, (0, 0))
    clip_alpha(gloss, mask)
    img = Image.alpha_composite(img, gloss)

    out = img
    clip_alpha(out, mask)
    return out

def save_set(master):
    for p in (ASSETS, BUILD, FRONT_PUBLIC, RENDERER):
        os.makedirs(p, exist_ok=True)
    master_path = os.path.join(ASSETS, "icon-1024.png")
    master.save(master_path)
    print("wrote", master_path)

    # build icons
    icon512 = master.resize((512, 512), Image.LANCZOS)
    icon512.save(os.path.join(BUILD, "icon.png"))
    icon256 = master.resize((256, 256), Image.LANCZOS)
    icon256.save(os.path.join(BUILD, "icon-256.png"))
    # multi-resolution ICO (Windows app + installer)
    ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64),
                 (128, 128), (256, 256)]
    # Pillow needs the base image large; it downscales per size
    base = master.resize((256, 256), Image.LANCZOS)
    base.save(os.path.join(BUILD, "icon.ico"), sizes=ico_sizes)
    print("wrote build/icon.ico + build/icon.png")

    # favicons (ICO + PNGs) for both frontends
    fav16 = master.resize((16, 16), Image.LANCZOS)
    fav32 = master.resize((32, 32), Image.LANCZOS)
    fav48 = master.resize((48, 48), Image.LANCZOS)
    fav48.save(os.path.join(BUILD, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
    for dest, name in ((FRONT_PUBLIC, "favicon.ico"), (RENDERER, "favicon.ico")):
        fav48.save(os.path.join(dest, name), sizes=[(16, 16), (32, 32), (48, 48)])
    for px, nm in ((16, "favicon-16x16.png"), (32, "favicon-32x32.png"),
                   (180, "apple-touch-icon.png"), (192, "icon-192.png"), (512, "icon-512.png")):
        im = master.resize((px, px), Image.LANCZOS)
        im.save(os.path.join(FRONT_PUBLIC, nm))
        if px in (32, 180):
            im.save(os.path.join(RENDERER, nm if px == 32 else "apple-touch-icon.png"))
    # renderer legacy 48px icon copy + electron PNG fallback in assets
    master.resize((48, 48), Image.LANCZOS).save(os.path.join(RENDERER, "favicon-48x48.png"))
    master.resize((512, 512), Image.LANCZOS).save(os.path.join(ASSETS, "icon.png"))
    print("wrote favicons + pwa icons")

if __name__ == "__main__":
    m = build_master(SIZE)
    save_set(m)
