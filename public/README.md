# Your branding

Drop your own files in this folder and the site picks them up automatically — no code change, no rebuild.

| File          | Where it shows                                       |
| ------------- | ---------------------------------------------------- |
| `logo.png`    | Header, footer and the sign-in screens                |
| `favicon.png` | Browser tab icon and the phone home-screen icon       |

Notes:

- `.png`, `.svg`, `.webp` and `.jpg` all work for the logo; `.png`, `.ico` and `.svg` for the favicon.
- The logo is drawn 40 px tall and keeps its aspect ratio, so a wide file of roughly 400×100 looks best.
- The favicon should be square, 512×512 is plenty.
- Remove the files and the built-in Aurea wordmark comes back.
- `models/` holds the generated profile artwork and is recreated by `npm run seed`.
