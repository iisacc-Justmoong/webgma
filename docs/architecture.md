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
  - is also reused as the browser preview shell
- `src/plugin/code.ts`
  - owns the Figma plugin lifecycle
  - runs static HTML/CSS analysis directly in the plugin runtime
  - renders the resulting design plan on the current page
- `src/plugin/render-design-plan.ts`
  - maps layout hints to Figma frames and text layers
  - applies the current auto-layout-related CSS subset

### Shared analysis side

- `src/shared/services/conversion-service.ts`
  - validates the HTML/CSS payload
  - runs the end-to-end static conversion flow
- `src/shared/services/inline-html-service.ts`
  - applies CSS declarations to HTML through static selector matching
- `src/shared/services/design-plan-service.ts`
  - parses merged inline HTML
  - produces a normalized tree of frames and text nodes
  - derives layout, appearance, and text hints for the renderer
- `src/shared/contracts.ts`
  - keeps the plugin and preview server in sync on request and response types

### Preview server side

- `src/backend/app.ts`
  - serves the browser preview shell at `/`
- `src/backend/views/plugin-ui-preview.ts`
  - loads the plugin UI HTML for preview mode

## Why this split

- static analysis belongs in a shared layer so the plugin owns conversion directly
- the plugin stays focused on Figma-specific node creation after analysis
- the preview server is reduced to UI hosting and no longer sits on the conversion path

## Immediate next steps

1. Add support for more selector types, margins, borders, and richer typography.
2. Improve CSS cascade fidelity for conflicting selectors and inheritance.
3. Introduce a stable node identity strategy so repeated imports can update existing nodes.
4. Add fixture-based regression tests for larger HTML/CSS samples.
5. Report unsupported CSS explicitly instead of silently dropping it.
