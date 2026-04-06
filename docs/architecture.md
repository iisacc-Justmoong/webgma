# Architecture

## Goal

The long-term product goal is:

1. receive HTML and CSS from two editors or uploaded files
2. merge them into a single inline HTML source
3. treat the merged HTML as the source of truth
4. convert that source into a Figma design with CSS-aware auto layout

## Current scaffold boundaries

The current repository state establishes the first version of the architecture without claiming full rendering parity.

### Plugin side

- `src/plugin/ui.html`
  - collects HTML and CSS input
  - lets the operator choose between typed code and uploaded files
  - shows merged HTML output and warnings
- `src/plugin/code.ts`
  - owns the Figma plugin lifecycle
  - sends conversion requests to the backend
  - receives the design plan and creates nodes on the current page
- `src/plugin/render-design-plan.ts`
  - maps layout hints to Figma frames and text layers
  - applies the first slice of auto-layout-related CSS

### Backend side

- `src/backend/app.ts`
  - defines the HTTP API surface
  - validates request payloads
- `src/backend/services/inline-html-service.ts`
  - merges CSS into HTML using `juice`
- `src/backend/services/design-plan-service.ts`
  - parses merged inline HTML
  - produces a normalized tree of frames and text nodes
  - derives layout, appearance, and text hints for the plugin renderer

### Shared contract

- `src/shared/contracts.ts`
  - keeps the plugin and backend in sync on request and response types

## Why this split

This split keeps the responsibilities explicit:

- the backend is the place for HTML/CSS parsing, normalization, and future browser-grade analysis
- the plugin stays focused on Figma-specific node creation
- the shared contract makes it possible to evolve the backend independently from the renderer

## Immediate next steps

1. Add CSS support for margin, borders, nested flex rules, and richer typography.
2. Introduce a stable node identity strategy so repeated imports can update existing nodes.
3. Replace heuristic layout defaults with more accurate DOM and computed-style extraction.
4. Add fixture-based regression tests for more realistic HTML/CSS samples.
5. Introduce an adapter layer for unsupported CSS so failures are reported instead of silently ignored.
