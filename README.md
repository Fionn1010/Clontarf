# Battle of Clontarf – Fionn Heritage Template

This package adapts the established Fionn single-page tour pattern for the Battle of Clontarf.

## Visitor flow

For each stop:

1. GPS destination
2. Cinematic videos play first, in sequence
3. AR experience
4. Optional walking instruction
5. Additional AR experience
6. Continue to the next stop

Stop 1 is configured as:

- `scene-1-video-1-first-sighting.mp4`
- `scene-1-video-2-armies-assemble.mp4`
- `scene-1-ar-1-stand-with-the-irish.glb`
- walking instruction to the seawall
- `scene-1-ar-2-viking-fleet.glb`

## Important: add your media assets

The ZIP contains the application files and folders, but not the large MP4, MP3 or GLB binaries from GitHub.

Place the files at the paths defined in `config/stops.json`.

Known video filenames already referenced:

- `assets/videos/scene-1-video-1-first-sighting.mp4`
- `assets/videos/scene-1-video-2-armies-assemble.mp4`
- `assets/videos/scene-2-video-1-brian-council.mp4`
- `assets/videos/scene-4-video-1-aftermath.mp4`

Other filenames are sensible placeholders and can be renamed in `config/stops.json`.

## Coordinates

The coordinates in `config/stops.json` are placeholders for testing. Replace them with the surveyed stop coordinates before release.

## AR models

Android/WebXR can use GLB files through `<model-viewer>`.

For iOS Quick Look, provide USDZ files and set each `iosModel` field in `config/stops.json`, for example:

```json
"iosModel": "assets/models/scene-1-ar-1-stand-with-the-irish.usdz"
```

## Testing

Run through a web server rather than opening `index.html` directly.

Examples:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Developer controls:

```text
?dev=1
```

## GitHub Pages

Upload the contents of this folder to the root of the Clontarf repository and enable GitHub Pages from the `main` branch.

## Service worker

`sw.js` caches the app shell and runtime assets. It also supports HTTP range requests for MP4 playback.

When changing cached files, update:

```js
const CACHE_NAME = "fionn-clontarf-v1";
```

to a new version, such as `fionn-clontarf-v2`.
