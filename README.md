# InkPad MVP
Stylus-first handwritten notes & PDF annotation for **Windows 11** (Surface Pen / Wacom / Windows Ink), with mouse & touch support. GoodNotes-style notebooks, pressure-sensitive ink, multi-page scroll, PDF import/annotation, vector PDF export. Offline only — IndexedDB, no backend.

## Quick start
Prerequisites: **Node 20+**, and for the Windows desktop build: WebView2 Runtime (preinstalled on Windows 11) + (Tauri path) Rust via rustup & MSVC Build Tools, or use the included **Electron fallback** (no Rust needed).

```bash
npm install
npm run dev            # web dev server http://localhost:5173
npm run electron:dev   # desktop (Electron/Chromium)
npm run build          # typecheck + production web build
npm test               # Vitest unit tests
npm run test:e2e       # Playwright smoke test (draw/undo/redo/reload)
npm run lint && npm run typecheck
npm run tauri build    # Windows installer (Electron fallback: NSIS .exe + .msi) -> release/
# Real Tauri (on a Rust-equipped Windows machine): npm i -D @tauri-apps/cli && npx tauri init && npx tauri build
```

## Manual stylus test (Surface / Wacom)
1. Create a notebook, draw with pen — width varies with pressure, stroke stays under the nib (~live canvas + rAF + `desynchronized`).
2. Flip pen to eraser end — cursor/tool switches to eraser until lift. Hold barrel button while writing — erases (configurable).
3. Hover pen — circular brush-size preview follows the nib. Rest palm / touch with other hand while pen was recently used — touch is ignored for drawing (toggle "Palm rejection" off to compare).
4. Ctrl+wheel / pinch to zoom 25–400%, Space (hold) or ✋ to pan, P/H/E shortcuts.
5. Import a PDF (button or drag-drop), annotate, Export PDF — ink is embedded as vector paths over original pages.

## Architecture
- **Model (pure TS, no React/DOM)**: `src/lib/types.ts` Notebook > Page > Stroke[]; page bg = template | PDF ref. `commands.ts` reversible command stack (cap 200, serializable), `eraser.ts` rbush spatial index, `geometry.ts` hit-testing/pressure, `serialization.ts` compact `[x,y,p]×n` point arrays, `pdfExport.ts` pdf-lib vector export.
- **Canvas layers per page**: background (template/PDF) / committed ink / live stroke. Only visible pages (+600px buffer) render; PDF renders are cached & cancelled when stale.
- **Input**: Pointer Events only — `pointerType`, `pressure`, `tiltX/Y`, `getCoalescedEvents()`, eraser-end (`buttons&32`/`button===5`), barrel (`buttons&2`), `touch-action:none`, no context menu/selection on the surface, optional Chromium `navigator.ink.requestPresenter`.
- **State/Storage**: Zustand store; Dexie/IndexedDB (`notebooks`, `pages`, `pdfs` blobs, `meta` history). Autosave debounced + on `beforeunload`.
- **Shell**: Electron fallback (see DECISIONS.md) packaging to Windows NSIS/MSI via electron-builder; code is Tauri-portable.

## Known limitations
- Electron fallback until built on a Rust-equipped Windows machine for the Tauri `.msi`; electron binary download requires network on first `npm run electron:dev`.
- PDF background re-renders on zoom change (crisp after settle) rather than continuous vector scaling; large PDFs rely on virtualization.
- Highlighter uses multiply blend on canvas; export approximates with 35% opacity. No text/shape/lasso/search/cloud (out of MVP scope).
- Playwright smoke test needs `npx playwright install chromium` once.
