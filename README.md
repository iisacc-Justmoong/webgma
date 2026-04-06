# Webgma

Webgma is a Figma plugin scaffold that turns HTML and CSS into a starter Figma layout through static analysis.

## Current flow

1. Choose one global input mode in the plugin UI.
2. `Mode 1` accepts one HTML file and an optional CSS file.
3. `Mode 2` accepts HTML code and optional CSS code through two text editors.
4. The convert action stays permissive in both modes: HTML is required, CSS is optional.
5. The plugin merges CSS into HTML with static selector analysis.
6. The merged inline HTML becomes the source of truth for the design plan.
7. The plugin converts that design plan into a Figma-safe transfer document.
8. The plugin renders that transfer document into Figma frames and text nodes.

## Repository layout

```text
src/
  plugin/
    code.ts
    render-design-plan.ts
    ui.html
  shared/
    contracts.ts
    services/
docs/
  architecture.md
  publishing.md
scripts/
  build-plugin.mjs
  plugin-build-config.mjs
  prepare-release.mjs
test/
  *.test.ts
manifest.json
```

## Supported scaffold scope

The current static-analysis scaffold already handles:

- centralized CSS loading through `src/shared/services/css-content-loader.ts`, including escaped HTML normalization, embedded `<style>` extraction, and stylesheet dependency stripping
- centralized CSS-to-Figma reinterpretation through `src/shared/services/figma-style-interpreter.ts`, which converts inline CSS into Figma-oriented layout, item-placement, appearance, and text hints
- centralized style implementation through `src/shared/services/style-implementation-service.ts`, which generates default fallback values for missing CSS tokens and resolves declarations into concrete inline styles
- centralized Figma handoff preparation through `src/shared/services/figma-transfer-service.ts`, which sanitizes the interpreted node tree into a renderer-safe transfer object
- tag, class, and id based CSS inlining
- HTML-only conversion when CSS input is empty or omitted
- decoding of escaped HTML input before DOM parsing
- extraction of embedded `<style>` blocks and removal of stylesheet `<link>` dependencies from the merged output
- normalization of `:root`, `:where()`, and `:is()` selectors into inlineable selectors
- resolution of CSS custom properties so `var(--token)` values become concrete inline styles
- generation of default fallback values for missing style tokens such as color, spacing, radius, typography, and shadow tokens
- preservation of selector-engine-supported structural selectors such as `:not()`, `:first-child`, and `:nth-child()`
- flex direction, gap, padding, width, height
- flex wrap, row/column gap, overflow clipping, min/max sizing
- child margin, `align-self`, `flex-grow`, `flex-shrink`, `flex-basis`, and absolute inset hints
- background color, opacity, border radius
- named colors and `hsl()` / `hsla()` inline color parsing
- border stroke and `box-shadow` appearance transfer into Figma frames
- mixed inline text fragments such as `Hello <strong>world</strong>`
- `<img>` and `background-image` based image assets
- basic text size, weight, line height, alignment, and color
- forced flattening of conditional rules and state selectors into inline HTML, with explicit warnings when fidelity is reduced

The next implementation phase should expand selector coverage, improve cascade fidelity, and harden layout parity with browser rendering.

## Scripts

- `npm run build`: bundle the plugin into `build/`
- `npm run prepare:release`: generate `build/release/` with a release manifest and packaged plugin files
- `npm test`: run the unit and interface tests

## Notes

- the plugin no longer includes sample input helpers
- the plugin no longer includes browser or merged-output preview features
- the plugin UI uses English-only copy
- the plugin opens with a safe default size and then applies a content-based resize after load
- the manifest permits remote image fetches so referenced image assets can be rendered
- the plugin bundle is emitted with an `es2017` target so Figma code evaluation does not fail on `??`, optional chaining, or object spread syntax
- the test suite compiles a temporary plugin bundle and fails if unsupported syntax survives bundling
- the root manifest is for development import, while `build/release/manifest.json` is generated for distribution packaging
- CSS is forced into inline HTML whenever possible, and flattening diagnostics are surfaced when selector or rule fidelity is reduced
- CSS loading is now isolated from CSS inlining so future parser work can expand from one shared source-loading layer
- style implementation is now isolated from selector matching so token fallback policy and declaration resolution can evolve without rewriting the merger
- CSS-to-Figma reinterpretation is now isolated from DOM traversal so style translation policy can evolve without rewriting the design-plan tree mapper
- Figma handoff preparation is now isolated from both interpretation and rendering so illegal or unsafe values can be normalized before the plugin touches the Figma runtime
- frame appearance is no longer limited to fills; border strokes and box shadows are also preserved in the design plan and renderer
- the design-plan layer now carries container layout hints and child placement hints separately so more CSS survives translation into Figma
- the renderer no longer consumes the raw design plan directly; it consumes a sanitized `figmaTransfer` payload that drops unsupported image sources, normalizes min/max ranges, and clips illegal numeric values before Figma setters run
- text nodes honor `max-width` during Figma rendering so long copy can wrap instead of expanding the root frame horizontally
- Figma `min/max` sizing constraints are now applied only on eligible auto-layout nodes or auto-layout children to avoid runtime setter errors
- the renderer now follows Figma-oriented auto-layout policy more closely: `NONE` frames skip auto-layout-only setters, and auto-layout frame children that use fill or stretch are forced onto Figma-compatible fixed axes

## Deployment

Figma publish preparation is documented in [publishing.md](/Volumes/Storage/Workspace/Product/Webgma/docs/publishing.md). The current setup aligns the manifest with Figma deployment requirements and prepares a packaged release folder without requiring manual path rewrites.
