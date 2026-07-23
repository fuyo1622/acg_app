# Asset provenance

## Application icons

The ACG Collector application icon is an original geometric design created for this repository. It depicts layered collection cards with a sparkle and contains no character artwork, third-party logo, watermark, or text.

Source and regeneration:

- `scripts/generate-icons.ps1` contains the deterministic vector drawing instructions.
- `public/favicon.svg` is the scalable browser icon.
- `public/apple-touch-icon.png` is 180×180.
- `public/pwa-192x192.png` is 192×192.
- `public/pwa-512x512.png` is 512×512.
- `public/pwa-maskable-512x512.png` is 512×512 with the foreground kept inside the maskable safe area.

On Windows, regenerate the complete icon set with:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\generate-icons.ps1
```

Do not replace these files with character artwork, promotional merchandise images, screenshots, or another party's trademark unless documented redistribution and branding rights have been obtained.

## User content

Photos selected by users are runtime data stored in their browser's IndexedDB. They are not part of the repository or the application distribution.
