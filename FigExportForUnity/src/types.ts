// =============================================================================
// Types — Figma Plugin + Manifest Schema
// Based on MANIFEST_SPEC.md v1.0
// =============================================================================

// ---------------------------------------------------------------------------
// Figma-side types (used during traversal)
// ---------------------------------------------------------------------------

/** Raw data collected from a Figma node during DFS traversal. */
export interface FigmaElement {
    id: string;
    name: string;
    type: string; // FRAME, TEXT, RECTANGLE, VECTOR, GROUP, COMPONENT, INSTANCE, BOOLEAN_OPERATION
    parentId: string | null;
    rect: Rect;
    constraints: { horizontal: string; vertical: string };
    fills: ReadonlyArray<Paint> | typeof figma.mixed;
    strokes: ReadonlyArray<Paint> | typeof figma.mixed;
    strokeWeight: number;
    strokeAlign: string; // 'INSIDE' | 'OUTSIDE' | 'CENTER'
    cornerRadius: number;
    opacity: number;
    visible: boolean;
    text?: FigmaTextProps;
    children: string[];
    exportable: boolean; // true if has visual content worth exporting as PNG
    autoLayout?: AutoLayoutProps;
    clipsContent?: boolean;
    tokens?: TokenBindings;  // design token bindings from Figma variables
}

/** Text properties extracted from a Figma TEXT node. */
export interface FigmaTextProps {
    content: string;
    fontFamily: string;
    fontStyle: string;
    fontSize: number;
    color: RGBA;
    alignment: string;
    lineHeight?: number;
    letterSpacing?: number;
}

/** Auto-layout properties from a Figma FRAME. */
export interface AutoLayoutProps {
    layoutMode: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
    paddingTop: number;
    paddingBottom: number;
    paddingLeft: number;
    paddingRight: number;
    itemSpacing: number;
    primaryAxisAlignItems: string;
    counterAxisAlignItems: string;
    /** "FIXED" | "AUTO" — AUTO means hug contents → ContentSizeFitter in Unity */
    primaryAxisSizingMode: 'FIXED' | 'AUTO';
    counterAxisSizingMode: 'FIXED' | 'AUTO';
}

// ---------------------------------------------------------------------------
// Design tokens (Figma variables bound to node properties)
// ---------------------------------------------------------------------------

/** One stop inside a gradient token. */
export interface GradientStop {
    position: number;   // 0–1 along the gradient
    color: RGBA;        // resolved RGBA 0-1
    tokenName?: string; // name of the bound variable for this stop, if any
}

/** Single resolved token reference. */
export interface TokenRef {
    id: string;             // Figma variable ID (of the primary/first bound variable)
    name: string;           // e.g. "Brand/Primary/500" or "Radius/Card"
    collection: string;     // variable collection name
    value: number | RGBA;   // resolved value: scalar for radius/opacity, or RGBA of first stop
    /** Present when the paint using this token is a gradient. e.g. "LINEAR" | "RADIAL" | "ANGULAR" | "DIAMOND" */
    gradientType?: string;
    /** Full list of gradient stops. Present only when gradientType is set. */
    gradientStops?: GradientStop[];
}

/** All token bindings for one element. Only present fields have bound variables. */
export interface TokenBindings {
    fill?: TokenRef;          // fill color token
    stroke?: StrokeTokenRef;  // stroke color + weight
    cornerRadius?: TokenRef;  // corner radius token
}

/** Stroke token: color token + weight info. */
export interface StrokeTokenRef extends TokenRef {
    /** Stroke thickness in Figma points. */
    weight: number;
    /** Name of the bound variable for strokeWeight, if any (e.g. "Stroke/str-2"). */
    weightTokenName?: string;
}

// ---------------------------------------------------------------------------
// Unity-side types (manifest output)
// ---------------------------------------------------------------------------

export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export type RGBA = [number, number, number, number]; // 0-1 range

export interface UnityTransform {
    anchorMin: [number, number];
    anchorMax: [number, number];
    pivot: [number, number];
    sizeDelta?: [number, number];
    offsetMin?: [number, number];
    offsetMax?: [number, number];
    localScale: [number, number, number];
}

export interface AssetBounds {
    x: number;
    y: number;
    w: number;
    h: number;
    pixelWidth: number;
    pixelHeight: number;
    exportScale: number;
}

export interface StrokeStyle {
    color: RGBA;
    weight: number;
    align: string; // 'INSIDE' | 'OUTSIDE' | 'CENTER'
}

export interface Style {
    fill?: RGBA;
    cornerRadius: number;
    opacity: number;
    stroke?: StrokeStyle;
    shadow?: Shadow;
}

export interface Shadow {
    x: number;
    y: number;
    blur: number;
    color: RGBA;
}

export interface TextProps {
    content: string;
    fontFamily: string;
    fontStyle: string;
    fontSize: number;
    color: RGBA;
    alignment: string;
    lineHeight?: number;
    letterSpacing?: number;
    /** Figma text style name, e.g. "H-XL", "P-P", "T". Present when node has a bound text style. */
    styleName?: string;
    /** Localization key when content follows dot-notation, e.g. "GroupSessions.Tab.Ongoing". */
    localizationKey?: string;
}

// ---------------------------------------------------------------------------
// Manifest schema (final JSON output)
// ---------------------------------------------------------------------------

export interface ManifestData {
    version: string;
    exportDate: string;
    screen: Screen;
    elements: ElementData[];
    assets: AssetEntry[];
    fonts: FontEntry[];
}

export interface Screen {
    name: string;
    figmaSize: { w: number; h: number };
    unityRefResolution: { w: number; h: number };
    exportScale: number;
}



export interface ElementData {
    id: string;
    name: string;
    figmaType: string;
    parentId: string | null;
    rect: Rect;
    unity: UnityTransform;
    components: string[];
    style?: Style;
    text?: TextProps;
    asset: string | null;
    assetBounds?: AssetBounds;
    interactive: boolean;
    children: string[];
    merged?: boolean; // true if this element was merged (flattened with children)
    autoLayout?: AutoLayoutProps;
    visible?: boolean; // omitted when true (all exported elements pass visibility filter)
    clipsContent?: boolean;
    tokens?: TokenBindings; // design token bindings
}

export interface AssetEntry {
    file: string;
    nodeId: string;
    scale: number;
}

export interface FontEntry {
    family: string;
    styles: string[];
}

// ---------------------------------------------------------------------------
// Export options (filter what gets exported)
// ---------------------------------------------------------------------------

export interface ExportOptions {
    includeText: boolean;
    includeImages: boolean;
    includeIcons: boolean;
    includeContainers: boolean;
    disableAutoMerge: boolean;
    slimManifest: boolean; // strip redundant rect/fill for sprite elements
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
    includeText: true,
    includeImages: true,
    includeIcons: true,
    includeContainers: true,
    disableAutoMerge: false,
    slimManifest: true,
};

/** Scale constraint for export. */
export interface ExportScale {
    type: 'SCALE' | 'WIDTH' | 'HEIGHT';
    value: number;
}

export const DEFAULT_EXPORT_SCALE: ExportScale = { type: 'SCALE', value: 2 };

// ---------------------------------------------------------------------------
// Layer tree element (main → UI on selection)
// ---------------------------------------------------------------------------

/** Lightweight element for the UI layer tree. */
export interface TreeElement {
    id: string;
    name: string;
    figmaType: string;
    depth: number;
    size: { w: number; h: number };
    cornerRadius: number;
    hasAsset: boolean;
    hasChildren: boolean;
    hasGradient: boolean;
}

// ---------------------------------------------------------------------------
// Per-element config (UI → main on export)
// ---------------------------------------------------------------------------

export interface ElementConfig {
    id: string;
    excluded: boolean;   // true = skip entirely
    merge: boolean;      // true = flatten parent+children into one PNG
    exportAsPng: boolean; // true = export TEXT as rasterized PNG instead of TMP data

}

// ---------------------------------------------------------------------------
// Plugin communication messages
// ---------------------------------------------------------------------------

/** Messages from UI → main. */
export type UIToMainMessage =
    | { type: 'export'; scale: ExportScale; options: ExportOptions; elementConfigs: ElementConfig[] }
    | { type: 'preview-element'; nodeId: string; excludedIds: string[] }
    | { type: 'highlight-element'; nodeId: string }
    | { type: 'lock-canvas'; locked: boolean }
    | { type: 'toggle-visibility'; nodeId: string; visible: boolean }
    | { type: 'reset-all-visibility'; nodeIds: string[] }
    | { type: 'rename-elements'; renames: { nodeId: string; newName: string }[] }
    | { type: 'resize-ui'; width: number; height: number }
    | { type: 'export-single-png'; nodeId: string; scale: ExportScale }
    | { type: 'toggle-lock'; nodeId: string; locked: boolean }
    | { type: 'reload' }
    | { type: 'cancel' }
    | { type: 'mcp-request'; payload: McpServerRequest };

/** Messages from main → UI. */
export type MainToUIMessage =
    | { type: 'selection-info'; name: string; elementCount: number; tree: TreeElement[]; selectedChildId?: string; locked?: boolean }
    | { type: 'no-selection' }
    | { type: 'progress'; current: number; total: number; label: string }
    | { type: 'export-complete'; manifest: string; assets: ExportedAsset[] }
    | { type: 'export-error'; message: string }
    | { type: 'element-preview'; nodeId: string; name: string; figmaType: string; size: { w: number; h: number }; imageData: number[] }
    | { type: 'visibility-changed'; changes: { nodeId: string; visible: boolean }[] }
    | { type: 'lock-changed'; changes: { nodeId: string; locked: boolean }[] }
    | { type: 'single-png-ready'; nodeId: string; data: number[] }
    | { type: 'highlight-tree-element'; nodeId: string }
    | { type: 'mcp-response'; payload: McpPluginResponse };

// ---------------------------------------------------------------------------
// MCP Bridge types
// ---------------------------------------------------------------------------

export type McpRequestType =
    | 'get_document'
    | 'get_selection'
    | 'get_node'
    | 'get_styles'
    | 'get_metadata'
    | 'get_design_context'
    | 'get_variable_defs'
    | 'get_screenshot';

export interface McpServerRequest {
    type: McpRequestType;
    requestId: string;
    nodeIds?: string[];
    params?: {
        format?: 'PNG' | 'SVG' | 'JPG' | 'PDF';
        scale?: number;
        depth?: number;
    };
}

export interface McpPluginResponse {
    type: McpRequestType;
    requestId: string;
    data?: unknown;
    error?: string;
}

export interface ExportedAsset {
    name: string;
    data: number[];
}
