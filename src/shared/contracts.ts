export type SourceMode = "code" | "file";

export interface SourceInput {
  content: string;
  mode: SourceMode;
  name?: string;
}

export interface ConversionRequest {
  html: SourceInput;
  css: SourceInput;
}

export interface ConversionResponse {
  mergedHtml: string;
  designPlan: DesignPlanDocument;
  warnings: string[];
}

export type FontStyleHint = "NORMAL" | "ITALIC";

export interface DesignPlanDocument {
  version: 1;
  metadata: {
    generatedAt: string;
    source: "inline-html";
  };
  root: DesignPlanNode;
}

export interface PaddingHints {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface InsetHints {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface LayoutHints {
  mode: "NONE" | "VERTICAL" | "HORIZONTAL";
  gap: number;
  crossGap: number;
  wrap: "NO_WRAP" | "WRAP";
  padding: PaddingHints;
  width?: number;
  height?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  clipsContent: boolean;
  justifyContent: "FLEX_START" | "CENTER" | "FLEX_END" | "SPACE_BETWEEN";
  alignItems: "FLEX_START" | "CENTER" | "FLEX_END" | "STRETCH";
}

export interface ItemLayoutHints {
  margin: PaddingHints;
  alignSelf: "AUTO" | "FLEX_START" | "CENTER" | "FLEX_END" | "STRETCH";
  flexGrow: number;
  flexShrink: number;
  flexBasis?: number;
  position: "AUTO" | "ABSOLUTE";
  inset: InsetHints;
  zIndex?: number;
}

export interface ColorHint {
  r: number;
  g: number;
  b: number;
  opacity: number;
}

export interface ImageHint {
  alt?: string;
  fit: "FILL" | "FIT";
  source: string;
  sourceType: "DATA" | "URL";
}

export interface StrokeHint {
  color: ColorHint;
  weight: number;
}

export interface ShadowHint {
  blur: number;
  color: ColorHint;
  offsetX: number;
  offsetY: number;
  type: "DROP_SHADOW" | "INNER_SHADOW";
}

export interface AppearanceHints {
  fills: ColorHint[];
  image?: ImageHint;
  shadows: ShadowHint[];
  strokes: StrokeHint[];
  cornerRadius?: number;
  opacity?: number;
}

export interface TextSegmentHints {
  end: number;
  fills: ColorHint[];
  fontSize?: number;
  fontStyle: FontStyleHint;
  fontWeight?: number;
  letterSpacing?: number;
  lineHeight?: number;
  start: number;
}

export interface TextHints {
  fontSize?: number;
  fontStyle: FontStyleHint;
  fontWeight?: number;
  lineHeight?: number;
  letterSpacing?: number;
  segments: TextSegmentHints[];
  textAlign: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
}

export type StyleMap = Record<string, string>;

export interface DesignPlanNode {
  id: string;
  kind: "FRAME" | "IMAGE" | "TEXT";
  name: string;
  tagName?: string;
  textContent?: string;
  styles: StyleMap;
  layout: LayoutHints;
  item: ItemLayoutHints;
  appearance: AppearanceHints;
  text?: TextHints;
  children: DesignPlanNode[];
}
