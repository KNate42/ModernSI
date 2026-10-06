"""
Keeps a copy of the static mock in the repository root, so GitHub Pages (which serves the root) still shows it.
design/mock stays the source of truth: run `python3 design/sync_pages.py` after editing the mock,
and `python3 design/sync_pages.py --check` to see whether the root copy has drifted.
This work made by Anfinogentov Nikita
"""
import shutil
import sys
from pathlib import Path

# There I list only the files the page really loads, tooling of the mock stays inside design/mock
served = ["index.html", "styles.css", "page.js", "intro.js"]

mock = Path(__file__).resolve().parent / "mock"
root = Path(__file__).resolve().parent.parent


def same(name):
    target = root / name
    return target.exists() and target.read_bytes() == (mock / name).read_bytes()


if "--check" in sys.argv:
    stale = [name for name in served if not same(name)]
    if stale:
        print("Ooops.. the root copy is out of date:", ", ".join(stale))
        sys.exit(1)
    print("the root copy matches design/mock")
    sys.exit(0)

for name in served:
    shutil.copyfile(mock / name, root / name)
    print("copied", name)

# There I switch Jekyll off, so Pages serves the files as they are and never tries to build the other folders
(root / ".nojekyll").touch()
