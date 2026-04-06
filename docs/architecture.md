# Architecture

## Goal

The product goal is:

1. receive HTML and CSS from files or code inputs
2. statically analyze both sources inside the plugin
3. merge CSS into a single inline HTML source
4. treat that merged HTML as the source of truth
5. reinterpret that source into a normalized design plan
6. sanitize the interpreted result into a Figma-safe transfer object
7. convert that transfer object into a Figma design with CSS-aware auto layout

## Current scaffold boundaries

### Plugin side

- `src/plugin/ui.html`
  - provides one global input mode switch
  - `Mode 1` accepts HTML and CSS files
  - `Mode 2` accepts HTML and CSS code
  - keeps all visible UI copy in English
  - measures the rendered content and requests a fit-to-content resize after load
  - intentionally excludes sample loaders and preview UI
- `src/plugin/code.ts`
  - owns the Figma plugin lifecycle
  - runs static HTML/CSS analysis directly in the plugin runtime
  - opens the UI with a safe default size so controls are visible even before the first resize message arrives
  - renders the resulting Figma transfer document on the current page
- `src/plugin/render-design-plan.ts`
  - consumes the Figma-safe transfer payload instead of the raw design plan
  - maps layout hints to Figma frames and text layers
  - applies the current auto-layout-related CSS subset
  - maps appearance hints such as fills, strokes, image fills, and shadows onto Figma nodes
  - applies child placement hints such as margin wrappers, flex growth, stretch alignment, and absolute positioning
  - respects text max-width constraints so long paragraphs wrap instead of stretching the imported page into one line
  - guards `min/max` sizing setters so they only run in Figma contexts that actually support those constraints
  - enforces Figma-oriented auto-layout policy so `NONE` frames avoid auto-layout-only setters and fill/stretch child frames are moved onto legal fixed axes
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
- `src/shared/services/css-content-loader.ts`
  - normalizes escaped HTML input before any CSS processing starts
  - extracts embedded `<style>` blocks into explicit CSS sources
  - removes stylesheet dependencies from the HTML so the merged output can become a single self-contained document
  - centralizes CSS source loading so selector parsing and design-plan generation can share one normalized HTML/CSS entry point
- `src/shared/services/figma-style-interpreter.ts`
  - reinterprets merged inline CSS into Figma-oriented layout, item-placement, appearance, and text hints
  - centralizes the policy for translating CSS values into the subset that the renderer can legally apply inside Figma
  - lets `design-plan-service.ts` focus on DOM tree mapping instead of embedding all style translation rules inline
- `src/shared/services/figma-transfer-service.ts`
  - prepares a renderer-safe handoff document from the raw design plan
  - removes fields the renderer does not need, such as raw style maps
  - normalizes illegal or risky values before the Figma runtime sees them, including invalid min/max ranges, out-of-bounds colors and opacity values, broken text ranges, and unsupported image URLs
- `src/shared/services/inline-html-service.ts`
  - consumes the shared CSS content loader instead of loading HTML/CSS sources itself
  - applies CSS declarations to HTML through static selector matching
  - resolves CSS custom properties and normalizes inlineable functional selectors such as `:root` and `:where(...)`
  - preserves structural pseudo selectors when the underlying selector engine can resolve them
  - flattens conditional rules and state selectors onto base elements when forcing a single inline HTML output
  - reports merge warnings when selector or rule fidelity is reduced
- `src/shared/services/design-plan-service.ts`
  - parses merged inline HTML
  - produces a normalized tree of frames and text nodes
  - preserves inline text fragments as styled text ranges
  - preserves `<img>` and `background-image` assets in the plan
  - delegates CSS-to-Figma reinterpretation to `figma-style-interpreter.ts`
  - carries border strokes, box shadows, and broader inline color formats into appearance hints
  - separates container layout hints from child item-placement hints so CSS survives the trip into Figma more faithfully
- `src/shared/contracts.ts`
  - keeps the plugin data contracts explicit
  - exposes the raw design-plan model and the sanitized Figma transfer model separately

## Why this split

- static analysis belongs in a shared layer so the plugin owns conversion directly
- the plugin stays focused on Figma-specific node creation after analysis and handoff sanitization
- the UI stays minimal and only collects real user input
- deployment packaging is isolated in `scripts/prepare-release.mjs` so release manifests can differ from local development manifests only by asset paths
- build compatibility checks compile the plugin into a temporary bundle during tests so unsupported syntax regressions such as nullish coalescing, optional chaining, and object spread are caught before release

## Immediate next steps

1. Add support for CSS grid, gradients, richer typography, and more complete background semantics.
2. Improve CSS cascade fidelity for conflicting selectors and inheritance.
3. Introduce a stable node identity strategy so repeated imports can update existing nodes.
4. Add fixture-based regression tests for larger HTML/CSS cases.
5. Expand warning coverage and fallback handling for more unsupported CSS patterns.
