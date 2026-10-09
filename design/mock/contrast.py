"""
Checks the palette of the mock (or of the app's tokens.css) against the visual identity slide:
every text/background pair reaches WCAG AA (4.5:1), the accent colours stay saturated (navy, teal, crimson, butter, royal),
the site is never black and white, and no background drifts into warm peach, beige, orange or pink.
Colours that the stylesheet mixes from two tokens (color-mix of a token with a token) are checked like tokens, so a grey or beige made by a mix cannot slip through.
This work made by Anfinogentov Nikita
"""
import colorsys
import re
import sys
from pathlib import Path

# There I list every token a theme must define, and the tokens text is allowed to sit on
required = [
    "--bg", "--surface", "--surface-2", "--border", "--fg", "--muted",
    "--accent", "--on-accent", "--accent-text", "--teal", "--on-teal", "--butter", "--on-butter",
    "--navy", "--on-navy", "--night", "--on-night", "--on-night-muted", "--royal", "--periwinkle",
    "--tint-teal", "--tint-sky", "--tint-steel", "--ink", "--intro-glow",
]
tints = ["--tint-teal", "--tint-sky", "--tint-steel"]
grounds = ["--bg", "--surface", "--surface-2"] + tints

# fg token, bg token: every pair I actually put text on
pairs = []
for ground in grounds:
    pairs += [("--fg", ground), ("--muted", ground), ("--accent-text", ground)]
pairs += [
    ("--on-accent", "--accent"), ("--on-teal", "--teal"), ("--on-butter", "--butter"),
    ("--on-navy", "--navy"), ("--on-night", "--night"), ("--on-night-muted", "--night"), ("--butter", "--night"), ("--butter", "--navy"),
]

# the accents carry the identity: chroma is (max - min) / 255 of the RGB channels
saturated = {
    "--accent": 0.5, "--teal": 0.25, "--butter": 0.3, "--royal": 0.4, "--periwinkle": 0.3,
    "--navy": 0.15, "--night": 0.12, "--ink": 0.15, "--intro-glow": 0.2,
}
# backgrounds may be a very quiet cream, but never a neutral grey
not_grey = ["--bg", "--surface-2", "--border", "--muted", "--on-night-muted", "--navy", "--night"] + tints
# cream is allowed (chroma below 0.05); a clear peach, beige, orange or pink is not
no_warm = ["--bg", "--surface", "--surface-2", "--border"] + tints


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


def mix(a, b, percent):
    # the result of color-mix(in srgb, a percent%, b), as a hex string
    return "".join(f"{round(int(a[i:i + 2], 16) * percent / 100 + int(b[i:i + 2], 16) * (100 - percent) / 100):02X}" for i in (0, 2, 4))


def check_mixes(css, tokens, name, failures):
    # mixes with transparent keep the colour of the thing below, so only token-with-token (or token-with-hex) mixes need a check
    pattern = r"color-mix\(in srgb,\s*var\((--[\w-]+)\)\s*(\d+)%,\s*(?:var\((--[\w-]+)\)|#([0-9A-Fa-f]{6}))\s*\)"
    for first, percent, second, second_hex in re.findall(pattern, css):
        a = tokens.get(first)
        b = tokens.get(second) if second else second_hex
        if not a or not b:
            continue
        result = mix(a, b, int(percent))
        label = f"{name} color-mix({first} {percent}%, {second or '#' + second_hex}) = #{result}"
        if chroma(result) < 0.015:
            failures.append(f"{label} is a neutral grey")
        elif chroma(result) >= 0.05 and (hue(result) < 75 or hue(result) > 335):
            failures.append(f"{label} is warm (peach, beige, orange or pink): hue {hue(result):.0f}")


def read_block(css, selector):
    # There I take the first block that starts with the selector and pull out its tokens
    start = css.index(selector)
    body = css[css.index("{", start) + 1:css.index("}", start)]
    return dict(re.findall(r"(--[\w-]+):\s*#([0-9A-Fa-f]{6})", body))


def main():
    # an optional path lets me check the app's tokens.css with the same rules
    css = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).with_name("styles.css")).read_text()
    failures = []

    # pure black is never used, and shadows are tinted with the navy, not with black
    if re.search(r"#000(000)?\b", css) or re.search(r"rgba?\(\s*0\s*[, ]\s*0\s*[, ]\s*0\b", css):
        failures.append("pure black (#000 or rgba(0,0,0)) found, tint it with the navy instead")

    light = read_block(css, ":root {")
    dark = {**light, **read_block(css, ':root[data-theme="dark"]')}
    # the system dark theme repeats the dark tokens; if the copies drift apart the two dark modes would differ
    system_dark = read_block(css, ':root:not([data-theme="light"])')
    for token, value in system_dark.items():
        if dark.get(token, "").upper() != value.upper():
            failures.append(f"system dark {token} differs from the data-theme dark block")
    themes = {"light": light, "dark": dark}

    for name, tokens in themes.items():
        missing = [token for token in required if token not in tokens]
        if missing:
            failures.append(f"{name} theme lacks: {', '.join(missing)}")
            continue
        for fg, bg in pairs:
            value = ratio(tokens[fg], tokens[bg])
            line = f"{name:5} {fg:14} on {bg:13} {value:5.2f}"
            print(line)
            if value < 4.5:
                failures.append(line)
        for token, minimum in saturated.items():
            value = chroma(tokens[token])
            if value < minimum:
                failures.append(f"{name} {token} {tokens[token]} is too grey: chroma {value:.3f} < {minimum}")
        for token in not_grey:
            if chroma(tokens[token]) < 0.015:
                failures.append(f"{name} {token} {tokens[token]} is a neutral grey")
        for token in no_warm:
            value = chroma(tokens[token])
            angle = hue(tokens[token])
            # hues from pink through red, orange and yellow are the peach, beige and cream family
            if value >= 0.05 and (angle < 75 or angle > 335):
                failures.append(f"{name} {token} {tokens[token]} is warm (peach, beige, orange or pink): hue {angle:.0f}")
        check_mixes(css, tokens, name, failures)
        # dark text must carry the navy, light text may be the quiet cream
        if luminance(tokens["--fg"]) < 0.3 and chroma(tokens["--fg"]) < 0.04:
            failures.append(f"{name} --fg {tokens['--fg']} is plain black or grey")
        # white is fine for cards and text on fills, but the page itself is never pure white or pure black
        for token in ["--bg", "--fg"]:
            if tokens[token].upper() in ("FFFFFF", "000000"):
                failures.append(f"{name} {token} is plain black or white")

    if failures:
        print("Ooops.. palette check failed:")
        for item in failures:
            print("  " + item)
        sys.exit(1)
    print("all pairs pass, the palette follows the slide and stays colourful")


main()
