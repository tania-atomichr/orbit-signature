"""Stitches the frames from scripts/walkthrough.mjs into docs/walkthrough.gif,
800 wide. Needs Pillow."""
import glob, os, shutil
from PIL import Image

here = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(here, "..", "docs", ".walk")
files = sorted(glob.glob(os.path.join(src, "*.png")))
out = []
for f in files:
    im = Image.open(f).convert("RGB")
    im = im.resize((800, round(im.height * 800 / im.width)), Image.LANCZOS)
    out.append(im.quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))
out[0].save(os.path.join(here, "..", "docs", "walkthrough.gif"), save_all=True, append_images=out[1:], duration=110, loop=0, optimize=True)
shutil.rmtree(src)
print("docs/walkthrough.gif:", len(out), "frames")
