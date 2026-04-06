# Webgma

Webgma is a Figma plugin scaffold for a pipeline with two responsibilities:

1. Collect HTML and CSS from code editors or uploaded files.
2. Merge both sources into a single inline-styled HTML document and treat that merged HTML as the source of truth for Figma generation.

The repository now contains the minimum project shape to start implementing the full workflow:

- a Figma plugin shell with a two-pane input UI
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

1. The plugin UI accepts HTML and CSS from textareas or file inputs.
2. The plugin main thread posts the request to the backend.
3. The backend uses `juice` to inline CSS into the HTML document.
4. The backend turns merged inline HTML into a design plan.
5. The plugin maps the design plan to starter Figma nodes with auto-layout hints.

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

## Notes

- `manifest.json` is configured for local backend access at `http://localhost:8787`.
- The backend route is `POST /v1/convert`.
- The Figma renderer is only a starter implementation. Unsupported CSS should be added in the design-plan and renderer layers, not bypassed in the UI.
