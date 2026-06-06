# 🥠 Fortune Cookie 3D · 幸运饼干

A polished 3D fortune cookie web app — click the cookie to crack it open and reveal a Chinese wisdom quote (with pinyin + English translation).

**Live demo:** _(will appear once Render finishes deploying)_

## Stack

- Three.js (loaded via CDN import map — no build step)
- Plain HTML/CSS/ES modules
- Static hosting on Render.com

## Features

- 3D cookie with procedural texture, custom lighting, idle animation
- Click-to-crack animation: shake → split → reveal paper slip
- Crumb particle burst with simple physics
- Curated quote bank (Lao Tzu, Confucius, Sun Tzu, classic proverbs, …) with pinyin + EN translation
- Frosted-glass quote card, gradient text, responsive layout

## Run locally

Just serve the directory — any static HTTP server works:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

(Opening `index.html` via `file://` won't work because of ES module CORS rules.)

## Deploy

`render.yaml` declares a static site. With the personal GitHub account connected to Render.com, pushing to `main` triggers a deploy automatically.

## License

MIT
