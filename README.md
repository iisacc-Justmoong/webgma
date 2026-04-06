# Webgma

Webgma is a Figma plugin scaffold for a pipeline with two responsibilities:

1. Collect HTML and CSS either from uploaded files or from code editors.
2. Merge both sources into a single inline-styled HTML document and treat that merged HTML as the source of truth for Figma generation.

The repository now contains the minimum project shape to start implementing the full workflow:

- a Figma plugin shell with two input modes
- a Node.js backend skeleton that merges HTML and CSS
- a design-plan generator that extracts a starter layout tree from inline styles
- tests and documentation for the current scaffold

## Repository layout

```text
src/
  backend/
    app.ts
    config.ts
    server.ts
    services/
  plugin/
    code.ts
    render-design-plan.ts
    ui.html
  shared/
    contracts.ts
docs/
  architecture.md
scripts/
  build-plugin.mjs
test/
  *.test.ts
manifest.json
```

## Current flow

1. The plugin UI exposes one global mode selector.
2. In `Mode 1`, the operator provides one HTML file and one CSS file.
3. In `Mode 2`, the operator provides HTML code and CSS code through two text editors.
4. The plugin main thread posts the request to the backend.
5. The backend uses `juice` to inline CSS into the HTML document.
6. The backend turns merged inline HTML into a design plan.
7. The plugin maps the design plan to starter Figma nodes with auto-layout hints.

## Supported scaffold scope

The current scaffold is intentionally narrow. It already handles:

- CSS inlining through the backend
- flex direction, gap, padding, width, height
- background color, opacity, border radius
- basic text size, weight, line height, alignment, and color

The next implementation phase should expand CSS coverage, improve text/font mapping, and harden layout parity with browser rendering.

## Scripts

- `npm run build`: bundle the plugin and backend into `build/`
- `npm run dev:backend`: run the backend in watch mode
- `npm test`: run the unit and API tests

## Browser preview

After running `npm run dev:backend`, open [http://localhost:8787](http://localhost:8787).

- `/` now serves the same two-input interface used by the plugin UI
- `Mode 1` in the browser preview accepts uploaded HTML/CSS files
- `Mode 2` in the browser preview accepts pasted HTML/CSS code
- in browser mode, the page can call `POST /v1/convert` and preview the merged HTML
- Figma node creation still requires the actual plugin runtime

## Notes

- `manifest.json` is configured for local backend access at `http://localhost:8787`.
- The backend route is `POST /v1/convert`.
- The Figma renderer is only a starter implementation. Unsupported CSS should be added in the design-plan and renderer layers, not bypassed in the UI.
