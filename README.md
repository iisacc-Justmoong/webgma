# Webgma

Webgma is a Figma plugin scaffold that turns HTML and CSS into a starter Figma layout through static analysis.

## What changed

- the plugin no longer sends conversion requests to a browser backend
- HTML and CSS are analyzed directly inside the plugin runtime
- the browser server is now only for previewing the UI shell during development

## Current flow

1. Choose one global input mode in the plugin UI.
2. `Mode 1` accepts one HTML file and one CSS file.
3. `Mode 2` accepts HTML code and CSS code through two text editors.
4. The plugin merges CSS into HTML with static selector analysis.
5. The merged inline HTML becomes the source of truth for the design plan.
6. The plugin renders that design plan into Figma frames and text nodes.

## Repository layout

```text
src/
  backend/
    app.ts
    config.ts
    server.ts
    views/
  plugin/
    code.ts
    render-design-plan.ts
    ui.html
  shared/
    contracts.ts
    services/
docs/
  architecture.md
scripts/
  build-plugin.mjs
test/
  *.test.ts
manifest.json
```

## Supported scaffold scope

The current static-analysis scaffold already handles:

- tag, class, and id based CSS inlining
- flex direction, gap, padding, width, height
- background color, opacity, border radius
- basic text size, weight, line height, alignment, and color

The next implementation phase should expand selector coverage, improve cascade fidelity, and harden layout parity with browser rendering.

## Scripts

- `npm run build`: bundle the plugin and preview server into `build/`
- `npm run dev:backend`: run the browser preview server in watch mode
- `npm test`: run the unit and interface tests

## Browser preview

After running `npm run dev:backend`, open [http://localhost:8787](http://localhost:8787).

- `/` serves the same UI shell used by the plugin
- the preview is for interface inspection only
- static analysis and Figma node creation still run only inside the plugin runtime

## Notes

- `manifest.json` no longer requires network access for conversion
- the preview server does not expose a conversion API anymore
- unsupported CSS should be added in the shared static-analysis layer and renderer, not bypassed in the UI
