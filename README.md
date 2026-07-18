# Battle of Clontarf AR Tour

A ready-to-upload GitHub Pages starter for a four-stop mobile heritage tour.

## Included

- Four tour stops
- Generated scene images
- Historical text and narration scripts
- AR-style immersive scene pages
- Browser text-to-speech narration
- Offline/slow-network support using `sw.js`
- Installable web-app manifest
- Responsive phone and desktop design

## Publish on GitHub Pages

1. Create a repository named `Clontarf`.
2. Upload the contents of this folder to the repository root.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select `main` and `/ (root)`, then save.
6. Your site should appear at:
   `https://YOUR-USERNAME.github.io/Clontarf/`

Service workers only operate over HTTPS or localhost. GitHub Pages provides HTTPS.

## Adding real AR models

This package currently uses the generated historical images as immersive AR-style previews because no GLB models or recorded audio were supplied.

Suggested model names:

- `assets/models/scene-1.glb`
- `assets/models/scene-2.glb`
- `assets/models/scene-3.glb`
- `assets/models/scene-4.glb`

Keep each model compressed and preferably below 10–15 MB for mobile Safari. Meshopt or Draco compression, reduced textures and KTX2 textures will help.

## Adding recorded narration

Place MP3 files here:

- `assets/audio/scene-1.mp3`
- `assets/audio/scene-2.mp3`
- `assets/audio/scene-3.mp3`
- `assets/audio/scene-4.mp3`

The current version uses the phone's built-in speech synthesis, so it works immediately without audio files.

## Editing the tour

All titles, descriptions and narration are stored in `stops.json`.

## Cache updates

Whenever you make an important update, change the cache name near the top of `sw.js`, for example:

`clontarf-tour-v1` → `clontarf-tour-v2`

This ensures returning visitors receive the new files.
