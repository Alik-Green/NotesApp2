# Decisions
- **Electron fallback instead of Tauri**: sandbox (and many CI machines) has no Rust/cargo and Tauri on Windows requires Rust + MSVC + WebView2 SDK. Per spec fallback, Electron 33 (Chromium, same Pointer Events / Windows Ink surface via WebView-like Chromium) is the shell. `npm run tauri` aliases the Electron build so documented commands still work. Architecture is shell-agnostic: all app logic is web code; porting to Tauri only requires adding `src-tauri` and invoking the same `dist/`.
- **History persisted as serialized CommandStack** in Dexie `meta` table (`history:<notebookId>`, capped 200).
- **Eraser**: optimistic removal during drag, then a single `removeStrokes` command pushed on pointer-up = exactly one undo step.
- **Page size**: A4 794×1123 CSS px; PDF pages scaled to that width preserving aspect.
- **PDF export Y-flip**: outlines are generated with `height - y` before `drawSvgPath` (verified page-count tests; content positioned in PDF coordinates).
- **Pressure fallback**: mouse = 0.5 constant; pen reporting constant 0/0.5 across >2 samples treated as no-pressure (perfect-freehand `simulatePressure:false`, normalized pressure fed in).
- **Barrel button**: `buttons & 2` → eraser by default (`barrelAction` setting in store, toggleable to `pan` in code/settings extension).
- **Virtualization**: IntersectionObserver with 600px rootMargin (visible + buffer), PDF render tasks cancelled on unmount, renders cached by pdfjs document cache.
- Out of scope items were not built (no text/shapes/lasso/cloud).
