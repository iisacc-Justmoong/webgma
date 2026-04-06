# Webgma

Webgma is a Figma plugin scaffold that turns HTML and CSS into a starter Figma layout through static analysis.

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

- tag, class, and id based CSS inlining
- flex direction, gap, padding, width, height
- background color, opacity, border radius
- mixed inline text fragments such as `Hello <strong>world</strong>`
- `<img>` and `background-image` based image assets
- basic text size, weight, line height, alignment, and color

The next implementation phase should expand selector coverage, improve cascade fidelity, and harden layout parity with browser rendering.

## Scripts

- `npm run build`: bundle the plugin into `build/`
- `npm run prepare:release`: generate `build/release/` with a release manifest and packaged plugin files
- `npm test`: run the unit and interface tests

## Notes

- the plugin no longer includes sample input helpers
- the plugin no longer includes browser or merged-output preview features
- the manifest permits remote image fetches so referenced image assets can be rendered
- the plugin bundle is emitted with an `es2017` target so Figma code evaluation does not fail on `??`, optional chaining, or object spread syntax
- the test suite compiles a temporary plugin bundle and fails if unsupported syntax survives bundling
- the root manifest is for development import, while `build/release/manifest.json` is generated for distribution packaging
- unsupported CSS should be added in the shared static-analysis layer and renderer, not bypassed in the UI

## Deployment

Figma publish preparation is documented in [publishing.md](/Volumes/Storage/Workspace/Product/Webgma/docs/publishing.md). The current setup aligns the manifest with Figma deployment requirements and prepares a packaged release folder without requiring manual path rewrites.
