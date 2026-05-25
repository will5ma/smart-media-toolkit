# WearableSearch Smart Media Toolkit

AI-powered media workspace with multiple tools in one unified interface.

**Live Demo → [will5ma.github.io/smart-media-toolkit](https://will5ma.github.io/smart-media-toolkit/)**

## Tools

| Tool | Description |
|------|-------------|
| **Smart Image Resizer** | Resize, crop, or pad images to any aspect ratio. Batch ZIP export. |
| **Smart Doc Compressor** | Compress PDF, DOC, PPT, HWP files while preserving quality. |
| **Smart GIF Studio** | Edit GIFs or convert videos (≤30s) to animated GIFs. |
| **YouTube Thumbnail** | Extract YouTube thumbnails in all resolutions including maxres. |
| **Smart Image Converter** | Convert between JPG, PNG, WEBP, GIF, SVG with batch ZIP download. |

## Tech Stack

- **Framework**: Next.js 16 (App Router, static export)
- **UI**: Tailwind CSS v4, Framer Motion, Lucide React
- **State**: Zustand
- **File handling**: React Dropzone, JSZip, pdf-lib, gif-encoder-2
- **Design**: Apple-style dark UI with mouse-driven aurora gradient background

## Development

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # static export → /out
```

---

© WearableSearch · 웨어러블서치
