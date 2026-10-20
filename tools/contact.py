# Contact sheet: python3 tools/contact.py out.png "label" img1 img2 ... (2 columns, labels from filenames)
import sys
from PIL import Image, ImageDraw
out, title, *imgs = sys.argv[1:]
ims = [Image.open(p).convert('RGB') for p in imgs]
w, h = 480, 270
cols = 2 if len(ims) > 1 else 1
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * w, rows * (h + 18) + 24), (8, 9, 14))
d = ImageDraw.Draw(sheet)
d.text((6, 6), title, fill=(230, 240, 255))
for i, (im, p) in enumerate(zip(ims, imgs)):
    x, y = (i % cols) * w, 24 + (i // cols) * (h + 18)
    sheet.paste(im.resize((w, h)), (x, y))
    d.text((x + 4, y + h + 3), p.split('/')[-1], fill=(150, 170, 200))
sheet.save(out)
