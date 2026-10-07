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
# the fonts are mirrored as a whole folder, every file in it is served
served_folders = ["fonts"]

mock = Path(__file__).resolve().parent / "mock"
root = Path(__file__).resolve().parent.parent


def folder_files(base, folder):
    # relative paths of the files in a folder, empty when the folder is missing
    path = base / folder
    return sorted(str(item.relative_to(base)) for item in path.rglob("*") if item.is_file()) if path.is_dir() else []


def wanted_files():
    names = list(served)
    for folder in served_folders:
        names += folder_files(mock, folder)
    return names


def same(name):
    target = root / name
    return target.exists() and target.read_bytes() == (mock / name).read_bytes()


if "--check" in sys.argv:
    stale = [name for name in wanted_files() if not same(name)]
    # a font that was removed from the mock must not linger in the root copy
    extra = [name for folder in served_folders for name in folder_files(root, folder) if not (mock / name).is_file()]
    if stale or extra:
        if stale:
            print("Ooops.. the root copy is out of date:", ", ".join(stale))
        if extra:
            print("Ooops.. the root copy has files the mock no longer has:", ", ".join(extra))
        sys.exit(1)
    print("the root copy matches design/mock")
    sys.exit(0)

for name in wanted_files():
    (root / name).parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(mock / name, root / name)
    print("copied", name)

for folder in served_folders:
    for name in folder_files(root, folder):
        if not (mock / name).is_file():
            (root / name).unlink()
            print("removed", name)

# There I switch Jekyll off, so Pages serves the files as they are and never tries to build the other folders
(root / ".nojekyll").touch()
