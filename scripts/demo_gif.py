"""Stitches the frames from scripts/docs.mjs into docs/demo.gif, the moving
picture at the top of the README. Needs Pillow."""
import glob, os, shutil
from PIL import Image

here = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(here, "..", "docs", ".frames")
files = sorted(glob.glob(os.path.join(src, "*.png")))
ims = [Image.open(f).convert("RGB") for f in files]
w = max(i.width for i in ims); h = max(i.height for i in ims)
out = []
for im in ims:
    c = Image.new("RGB", (w + 48, h + 48), "#f7f6f9")
    c.paste(im, (24, 24 + (h - im.height) // 2))
    out.append(c.quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))
out[0].save(os.path.join(here, "..", "docs", "demo.gif"), save_all=True, append_images=out[1:], duration=110, loop=0, optimize=True)
shutil.rmtree(src)
print("docs/demo.gif:", len(out), "frames")
