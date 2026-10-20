# Night Courier

Rain-soaked cyberpunk hover-bike courier game. Desktop browser (Chrome/Edge), keyboard + mouse.

## Play it

- **Hosted (GitHub Pages):** Settings → Pages → Source "Deploy from a branch" → pick this branch, folder `/docs` → Save. The URL appears after about a minute.
- **Offline:** download `builds/play/NightCourier.html` (on GitHub use the "Download raw file" button, not copy/paste), keep the `.html` extension and double-click it. It is one self-contained file and works from `file://`.

Opening the file on github.com only shows its source code, and it is too big (5.4 MB) to run as a claude.ai artifact — use one of the options above.

Controls and details: see `FINAL REPORT.md`.

## If it shows a black screen or "page isn't responding"

The game needs **GPU (hardware) acceleration** in the browser. Without it Chrome falls back to a software renderer that takes ~10 s per frame.
Check `chrome://gpu` (WebGL2 should say "Hardware accelerated") and turn on Settings → System → "Use graphics acceleration when available", then restart the browser.
The loader now shows progress, switches to Low quality automatically on slow graphics, and says so on the title screen.
