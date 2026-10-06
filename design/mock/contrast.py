"""
Checks the palette of the mock (or of the app's tokens.css):
every text/background pair reaches WCAG AA (4.5:1), no forbidden university colour sneaks in,
the site is never black and white, and no background drifts into warm peach, beige or cream.
This work made by Anfinogentov Nikita
"""
import colorsys
import re
import sys
from pathlib import Path

forbidden = ["AB0520", "0C234B", "001C48", "1E5288", "8B0015", "EF4056", "81D3EB", "378DBD", "007D84", "70B865", "A95C42"]
tints = ["--tint-violet", "--tint-sky", "--tint-mint", "--tint-rose"]

# fg token, bg token: every pair I actually put text on
pairs = [
    ("--fg", "--bg"), ("--fg", "--surface"),
    ("--muted", "--bg"), ("--muted", "--surface"),
    ("--accent-text", "--bg"), ("--accent-text", "--surface"),
    ("--on-accent", "--accent"),
]
for tint in tints:
    pairs += [("--fg", tint), ("--muted", tint), ("--accent-text", tint)]

# backgrounds must carry real colour: chroma is (max - min) / 255 of the RGB channels
colourful = {"--bg": 0.06, "--surface": 0.015, "--tint-violet": 0.06, "--tint-sky": 0.06, "--tint-mint": 0.06, "--tint-rose": 0.06,
             "--ink": 0.2, "--intro-glow": 0.2}


def channels(hex_colour):
    return [int(hex_colour[i:i + 2], 16) / 255 for i in (0, 2, 4)]


def luminance(hex_colour):
    linear = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels(hex_colour)]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def ratio(a, b):
    la, lb = luminance(a), luminance(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def chroma(hex_colour):
    values = channels(hex_colour)
    return max(values) - min(values)


def hue(hex_colour):
    red, green, blue = channels(hex_colour)
    return colorsys.rgb_to_hls(red, green, blue)[0] * 360


def read_block(css, selector):
    # There I take the first block that starts with the selector and pull out its tokens
    start = css.index(selector)
    body = css[css.index("{", start) + 1:css.index("}", start)]
    return dict(re.findall(r"(--[\w-]+):\s*#([0-9A-Fa-f]{6})", body))


def main():
    # an optional path lets me check the app's tokens.css with the same rules
    css = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).with_name("styles.css")).read_text()
    failures = []
    for colour in forbidden:
        if colour.lower() in css.lower():
            failures.append("forbidden colour #" + colour)

    light = read_block(css, ":root {")
    dark = {**light, **read_block(css, ':root[data-theme="dark"]')}
    # the system dark theme repeats the dark tokens; if the copies drift apart the two dark modes would differ
    system_dark = read_block(css, ':root:not([data-theme="light"])')
    for token, value in system_dark.items():
        if dark.get(token, "").upper() != value.upper():
            failures.append(f"system dark {token} differs from the data-theme dark block")
    themes = {"light": light, "dark": dark}

    for name, tokens in themes.items():
        for fg, bg in pairs:
            value = ratio(tokens[fg], tokens[bg])
            line = f"{name:5} {fg:14} on {bg:13} {value:5.2f}"
            print(line)
            if value < 4.5:
                failures.append(line)
        for token, minimum in colourful.items():
            value = chroma(tokens[token])
            if value < minimum:
                failures.append(f"{name} {token} {tokens[token]} is too grey: chroma {value:.3f} < {minimum}")
            # hues from red through orange to yellow are the peach, beige and cream family
            if value >= 0.015 and hue(tokens[token]) < 75:
                failures.append(f"{name} {token} {tokens[token]} is warm (peach, beige or cream): hue {hue(tokens[token]):.0f}")
        if chroma(tokens["--fg"]) < 0.04:
            failures.append(f"{name} --fg {tokens['--fg']} is plain black or white")

    if failures:
        print("Ooops.. palette check failed:")
        for item in failures:
            print("  " + item)
        sys.exit(1)
    print("all pairs pass, the palette is colourful and cool")


main()
