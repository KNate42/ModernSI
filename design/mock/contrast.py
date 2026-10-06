"""
Checks that every text/background token pair of the mock reaches WCAG AA (4.5:1)
and that no forbidden university colour sneaks into the stylesheet.
This work made by Anfinogentov Nikita
"""
import re
import sys
from pathlib import Path

forbidden = ["AB0520", "0C234B", "001C48", "1E5288", "8B0015", "EF4056", "81D3EB", "378DBD", "007D84", "70B865", "A95C42"]

# fg token, bg token: every pair I actually put text on
pairs = [
    ("--fg", "--bg"), ("--fg", "--surface"),
    ("--muted", "--bg"), ("--muted", "--surface"),
    ("--accent-text", "--bg"), ("--accent-text", "--surface"),
    ("--on-accent", "--accent"),
]


def luminance(hex_colour):
    channels = [int(hex_colour[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    channels = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]


def ratio(a, b):
    la, lb = luminance(a), luminance(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def read_block(css, selector):
    # There I take the first block that starts with the selector and pull out its tokens
    start = css.index(selector)
    body = css[css.index("{", start) + 1:css.index("}", start)]
    return dict(re.findall(r"(--[\w-]+):\s*#([0-9A-Fa-f]{6})", body))


def main():
    css = Path(__file__).with_name("styles.css").read_text()
    failures = []
    for colour in forbidden:
        if colour.lower() in css.lower():
            failures.append("forbidden colour #" + colour)
    themes = {"dark": read_block(css, ":root {"), "light": read_block(css, ':root[data-theme="light"]')}
    for name, tokens in themes.items():
        for fg, bg in pairs:
            value = ratio(tokens[fg], tokens[bg])
            line = f"{name:5} {fg:14} on {bg:10} {value:5.2f}"
            print(line)
            if value < 4.5:
                failures.append(line)
    if failures:
        print("Ooops.. contrast/brand check failed:")
        for item in failures:
            print("  " + item)
        sys.exit(1)
    print("all pairs pass")


main()
