# Architecture

## Goal

The product goal is:

1. receive HTML and CSS from files or code inputs
2. statically analyze both sources inside the plugin
3. merge CSS into a single inline HTML source
4. treat that merged HTML as the source of truth
5. convert that source into a Figma design with CSS-aware auto layout

## Current scaffold boundaries

### Plugin side

- `src/plugin/ui.html`
  - provides one global input mode switch
  - `Mode 1` accepts HTML and CSS files
  - `Mode 2` accepts HTML and CSS code
  - keeps all visible UI copy in English
  - measures the rendered content and requests an initial hug-sized UI before first display
  - intentionally excludes sample loaders and preview UI
- `src/plugin/code.ts`
  - owns the Figma plugin lifecycle
  - runs static HTML/CSS analysis directly in the plugin runtime
  - keeps the UI hidden until the first size measurement arrives, then shows it
  - renders the resulting design plan on the current page
- `src/plugin/render-design-plan.ts`
  - maps layout hints to Figma frames and text layers
  - applies the current auto-layout-related CSS subset
- `scripts/build-plugin.mjs`
  - bundles the plugin into `build/`
  - targets `es2017` so the generated code stays compatible with Figma's plugin code evaluator
- `scripts/plugin-build-config.mjs`
  - centralizes plugin bundling options shared by the build script and regression tests
  - prevents config drift between local packaging and compatibility checks

### Shared analysis side

- `src/shared/services/conversion-service.ts`
  - validates the HTML/CSS payload
  - runs the end-to-end static conversion flow
- `src/shared/services/inline-html-service.ts`
  - applies CSS declarations to HTML through static selector matching
  - extracts embedded `<style>` blocks and removes stylesheet links so the merged HTML stays self-contained
  - flattens conditional rules and state selectors onto base elements when forcing a single inline HTML output
  - reports merge warnings when selector or rule fidelity is reduced
- `src/shared/services/design-plan-service.ts`
  - parses merged inline HTML
  - produces a normalized tree of frames and text nodes
  - preserves inline text fragments as styled text ranges
  - preserves `<img>` and `background-image` assets in the plan
  - derives layout, appearance, and text hints for the renderer
- `src/shared/contracts.ts`
  - keeps the plugin data contracts explicit

## Why this split

- static analysis belongs in a shared layer so the plugin owns conversion directly
- the plugin stays focused on Figma-specific node creation after analysis
- the UI stays minimal and only collects real user input
- deployment packaging is isolated in `scripts/prepare-release.mjs` so release manifests can differ from local development manifests only by asset paths
- build compatibility checks compile the plugin into a temporary bundle during tests so unsupported syntax regressions such as nullish coalescing, optional chaining, and object spread are caught before release

## Immediate next steps

1. Add support for more selector types, margins, borders, and richer typography.
2. Improve CSS cascade fidelity for conflicting selectors and inheritance.
3. Introduce a stable node identity strategy so repeated imports can update existing nodes.
4. Add fixture-based regression tests for larger HTML/CSS cases.
5. Expand warning coverage and fallback handling for more unsupported CSS patterns.
