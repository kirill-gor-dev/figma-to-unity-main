// =============================================================================
// Traverser — DFS Node Traversal
// Walks the Figma node tree and collects FigmaElement data.
// =============================================================================

import type { FigmaElement, FigmaTextProps, RGBA, AutoLayoutProps, TokenBindings, TokenRef, Rect } from './types';

interface AbsoluteBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Traverse a Figma node tree using depth-first search.
 * Returns a flat array of FigmaElement, maintaining parent-child relationships via IDs.
 *
 * @param rootNode - The selected Figma node (typically a Frame/Component)
 * @returns Flat array of all visible elements
 */
export function traverseNode(rootNode: SceneNode): FigmaElement[] {
    const elements: FigmaElement[] = [];
    walkNode(rootNode, null, elements);
    return elements;
}

// ---------------------------------------------------------------------------
// Recursive DFS walker
// ---------------------------------------------------------------------------

function walkNode(
    node: SceneNode,
    parentId: string | null,
    elements: FigmaElement[]
): void {
    // Include all nodes (visible and hidden) — UI will auto-exclude hidden ones

    const element = extractElement(node, parentId);
    elements.push(element);

    // Recurse into children if the node has them
    if ('children' in node) {
        const container = node as ChildrenMixin & SceneNode;
        for (const child of container.children) {
            walkNode(child, node.id, elements);
        }
        // Populate children IDs (all children, including hidden)
        element.children = container.children
            .map((c) => c.id);
    }
}

// ---------------------------------------------------------------------------
// Extract element data from a Figma node
// ---------------------------------------------------------------------------

function extractElement(node: SceneNode, parentId: string | null): FigmaElement {
    const rect = getRect(node);
    const constraints = getConstraints(node);
    const fills = getFills(node);
    const { strokes, strokeWeight, strokeAlign } = getStrokeProps(node);
    const cornerRadius = getCornerRadius(node);
    const opacity = getOpacity(node);
    const text = getTextProps(node);
    const autoLayout = getAutoLayoutProps(node);
    const clipsContent = getClipsContent(node);
    const exportable = isExportable(node);
    const tokens = getTokenBindings(node);

    return {
        id: node.id,
        name: node.name,
        type: node.type,
        parentId,
        rect,
        constraints,
        fills,
        strokes,
        strokeWeight,
        strokeAlign,
        cornerRadius,
        opacity,
        visible: node.visible,
        text: text ?? undefined,
        children: [],
        exportable,
        autoLayout: autoLayout ?? undefined,
        clipsContent: clipsContent || undefined,
        tokens: tokens ?? undefined,
    };
}

// ---------------------------------------------------------------------------
// Property extractors
// ---------------------------------------------------------------------------

function getRect(node: SceneNode): Rect {
    const absoluteBounds = readAbsoluteBounds(node);
    const parentBounds = readParentAbsoluteBounds(node);

    const x = absoluteBounds && parentBounds
        ? absoluteBounds.x - parentBounds.x
        : node.x;
    const y = absoluteBounds && parentBounds
        ? absoluteBounds.y - parentBounds.y
        : node.y;
    const w = absoluteBounds ? absoluteBounds.width : node.width;
    const h = absoluteBounds ? absoluteBounds.height : node.height;

    return { x, y, w, h };
}

function readAbsoluteBounds(node: SceneNode): AbsoluteBounds | null {
    const bounds = (node as any).absoluteBoundingBox;
    return isValidAbsoluteBounds(bounds) ? bounds as AbsoluteBounds : null;
}

function readParentAbsoluteBounds(node: SceneNode): AbsoluteBounds | null {
    const parent = (node as any).parent;
    if (!parent || parent.type === 'PAGE') {
        return null;
    }

    const bounds = (parent as any).absoluteBoundingBox;
    return isValidAbsoluteBounds(bounds) ? bounds as AbsoluteBounds : null;
}

function isValidAbsoluteBounds(value: any): value is AbsoluteBounds {
    return !!value
        && typeof value.x === 'number'
        && typeof value.y === 'number'
        && typeof value.width === 'number'
        && typeof value.height === 'number'
        && value.width > 0
        && value.height > 0;
}

function getConstraints(node: SceneNode): { horizontal: string; vertical: string } {
    if ('constraints' in node) {
        const c = (node as ConstraintMixin).constraints;
        return {
            horizontal: c.horizontal,
            vertical: c.vertical,
        };
    }
    // Default: pin to top-left
    return { horizontal: 'MIN', vertical: 'MIN' };
}

function getFills(node: SceneNode): ReadonlyArray<Paint> | typeof figma.mixed {
    if ('fills' in node) {
        return (node as GeometryMixin).fills;
    }
    return [];
}

function getStrokeProps(node: SceneNode): {
    strokes: ReadonlyArray<Paint> | typeof figma.mixed;
    strokeWeight: number;
    strokeAlign: string;
} {
    if ('strokes' in node) {
        const g = node as GeometryMixin;
        return {
            strokes: g.strokes,
            strokeWeight: typeof (g as any).strokeWeight === 'number' ? (g as any).strokeWeight : 0,
            strokeAlign: (g as any).strokeAlign ?? 'INSIDE',
        };
    }
    return { strokes: [], strokeWeight: 0, strokeAlign: 'INSIDE' };
}

function getCornerRadius(node: SceneNode): number {
    if ('cornerRadius' in node) {
        const cr = (node as CornerMixin).cornerRadius;
        if (typeof cr === 'number') return cr;
        // Mixed corner radius: use the max value
        if ('topLeftRadius' in node) {
            const rn = node as RectangleCornerMixin;
            return Math.max(
                rn.topLeftRadius ?? 0,
                rn.topRightRadius ?? 0,
                rn.bottomLeftRadius ?? 0,
                rn.bottomRightRadius ?? 0
            );
        }
    }
    return 0;
}

function getOpacity(node: SceneNode): number {
    if ('opacity' in node) {
        return (node as BlendMixin).opacity;
    }
    return 1;
}

function getClipsContent(node: SceneNode): boolean {
    if ('clipsContent' in node) {
        return Boolean((node as SceneNode & { clipsContent?: boolean }).clipsContent);
    }
    return false;
}

function getTextProps(node: SceneNode): FigmaTextProps | null {
    if (node.type !== 'TEXT') return null;

    const textNode = node as TextNode;
    const rawContent = resolveTextContent(textNode);
    const textCase = getTextProperty(textNode, 'textCase', (value: TextCase) => value, 'ORIGINAL');
    const content = applyTextCase(rawContent, textCase);

    // Get font properties (handle mixed values)
    const fontFamily = getTextProperty(textNode, 'fontName', (fn: FontName) => fn.family, 'Inter');
    const fontStyle = getTextProperty(textNode, 'fontName', (fn: FontName) => fn.style, 'Regular');
    const fontSize = getTextProperty(textNode, 'fontSize', (s: number) => s, 16);
    const color = getTextColor(textNode);
    const alignment = mapTextAlignment(textNode);
    const lineHeight = getLineHeight(textNode);
    const letterSpacing = getLetterSpacing(textNode);

    // Text style name from bound Figma text style (e.g. "H-XL", "P-P")
    const styleName = getTextStyleName(textNode);

    // Localization key — content that matches dot-notation, e.g. "GroupSessions.Tab.Ongoing"
    const localizationKey = isLocalizationKey(content) ? content : undefined;

    // Text fill color token from bound Figma variable
    const colorToken = getTextColorToken(textNode);

    return {
        content,
        fontFamily,
        fontStyle,
        fontSize,
        color,
        ...(colorToken ? { colorToken } : {}),
        alignment,
        lineHeight: lineHeight ?? undefined,
        letterSpacing: letterSpacing ?? undefined,
        ...(styleName ? { styleName } : {}),
        ...(localizationKey ? { localizationKey } : {}),
    };
}

/**
 * Returns true when the string looks like a localization key:
 *   - No whitespace or newlines
 *   - Contains at least one dot
 *   - Every dot-separated segment starts with an uppercase letter
 *   e.g. "GroupSessions.Tab.Ongoing", "Common.Button.OK"
 */
function isLocalizationKey(text: string): boolean {
    if (!text || /\s/.test(text)) return false;
    const segments = text.split('.');
    if (segments.length < 2) return false;
    return segments.every((seg) => seg.length > 0 && /^[A-Z]/.test(seg));
}

/** Returns the Figma text style name bound to this node, e.g. "H-XL" or "P-S · 15/20". */
function getTextStyleName(textNode: TextNode): string | null {
    try {
        const styleId = textNode.textStyleId;
        if (!styleId || styleId === figma.mixed) return null;
        const style = figma.getStyleById(styleId as string);
        return style?.name ?? null;
    } catch {
        return null;
    }
}

function resolveTextContent(textNode: TextNode): string {
    const directContent = typeof textNode.characters === 'string' ? textNode.characters : '';
    const propertyReference = getTextComponentPropertyReference(textNode);
    if (!propertyReference) {
        return directContent;
    }

    const instanceOverride = getInstanceTextOverride(textNode, propertyReference);
    if (typeof instanceOverride === 'string' && instanceOverride.length > 0) {
        return instanceOverride;
    }

    return directContent;
}

function getTextComponentPropertyReference(textNode: TextNode): string | null {
    const references = (textNode as any).componentPropertyReferences;
    if (!references || typeof references !== 'object') {
        return null;
    }

    if (typeof references.characters === 'string' && references.characters.length > 0) {
        return references.characters;
    }

    if (typeof references.text === 'string' && references.text.length > 0) {
        return references.text;
    }

    return null;
}

function getInstanceTextOverride(textNode: TextNode, propertyReference: string): string | null {
    let parent: BaseNode | null = textNode.parent;
    while (parent) {
        if (parent.type === 'INSTANCE') {
            const componentProperties = (parent as any).componentProperties;
            if (componentProperties && typeof componentProperties === 'object') {
                const directMatch = componentProperties[propertyReference];
                if (directMatch && typeof directMatch.value === 'string' && directMatch.value.length > 0) {
                    return directMatch.value;
                }

                const entries = Object.keys(componentProperties);
                for (let index = 0; index < entries.length; index++) {
                    const key = entries[index];
                    const entry = componentProperties[key];
                    if (!entry || typeof entry !== 'object') continue;

                    if (typeof entry.value === 'string' && typeof entry.name === 'string') {
                        const normalizedReference = propertyReference.toLowerCase();
                        const normalizedName = entry.name.toLowerCase();
                        if (normalizedReference.indexOf(normalizedName) >= 0 && entry.value.length > 0) {
                            return entry.value;
                        }
                    }
                }
            }
        }
        parent = parent.parent;
    }

    return null;
}

function applyTextCase(content: string, textCase: TextCase): string {
    switch (textCase) {
        case 'UPPER':
        case 'SMALL_CAPS_FORCED':
            return content.toUpperCase();
        case 'LOWER':
            return content.toLowerCase();
        case 'TITLE':
            return content.replace(/\S+/g, function (word) {
                return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
            });
        case 'SMALL_CAPS':
        case 'ORIGINAL':
        default:
            return content;
    }
}

function getAutoLayoutProps(node: SceneNode): AutoLayoutProps | null {
    if (!('layoutMode' in node)) return null;

    const frame = node as FrameNode;
    if (frame.layoutMode === 'NONE') return null;

    return {
        layoutMode: frame.layoutMode as 'HORIZONTAL' | 'VERTICAL',
        paddingTop: frame.paddingTop ?? 0,
        paddingBottom: frame.paddingBottom ?? 0,
        paddingLeft: frame.paddingLeft ?? 0,
        paddingRight: frame.paddingRight ?? 0,
        itemSpacing: frame.itemSpacing ?? 0,
        primaryAxisAlignItems: (frame.primaryAxisAlignItems as string) ?? 'MIN',
        counterAxisAlignItems: (frame.counterAxisAlignItems as string) ?? 'MIN',
        primaryAxisSizingMode: ((frame as any).primaryAxisSizingMode as 'FIXED' | 'AUTO') ?? 'FIXED',
        counterAxisSizingMode: ((frame as any).counterAxisSizingMode as 'FIXED' | 'AUTO') ?? 'FIXED',
    };
}

// ---------------------------------------------------------------------------
// Design token extraction (Figma Variables / boundVariables)
// ---------------------------------------------------------------------------

function getTokenBindings(node: SceneNode): TokenBindings | undefined {
    const bv = (node as any).boundVariables;
    if (!bv) return undefined;

    const result: TokenBindings = {};

    // Fill color token
    const fillBindings = bv.fills;
    if (Array.isArray(fillBindings) && fillBindings.length > 0) {
        const firstFill = getFirstVisiblePaint(node, 'fills');
        const gradType = firstFill ? gradientTypeFromPaintType(firstFill.type) : null;

        if (gradType && firstFill && 'gradientStops' in firstFill) {
            // Gradient fill — collect all stops with their token bindings
            const ref = buildGradientTokenRef(firstFill as GradientPaint, fillBindings, gradType);
            if (ref) result.fill = ref;
        } else {
            // Solid fill — single color token
            const fillAlias = fillBindings[0]?.color ?? fillBindings[0];
            const ref = resolveTokenRef(fillAlias);
            if (ref) result.fill = ref;
        }
    }

    // Stroke color token
    const strokeBindings = bv.strokes;
    if (Array.isArray(strokeBindings) && strokeBindings.length > 0) {
        const firstStroke = getFirstVisiblePaint(node, 'strokes');
        const gradType = firstStroke ? gradientTypeFromPaintType(firstStroke.type) : null;

        let colorRef: TokenRef | null = null;
        if (gradType && firstStroke && 'gradientStops' in firstStroke) {
            colorRef = buildGradientTokenRef(firstStroke as GradientPaint, strokeBindings, gradType);
        } else {
            const strokeAlias = strokeBindings[0]?.color ?? strokeBindings[0];
            colorRef = resolveTokenRef(strokeAlias);
        }

        if (colorRef) {
            // Stroke weight — raw value from node
            const rawWeight = ('strokeWeight' in node) ? (node as any).strokeWeight : 1;
            const weight = typeof rawWeight === 'number' ? rawWeight : 1;

            // Stroke weight token binding (optional)
            let weightTokenName: string | undefined;
            if (bv.strokeWeight?.type === 'VARIABLE_ALIAS') {
                try {
                    const v = figma.variables.getVariableById(bv.strokeWeight.id);
                    if (v) weightTokenName = v.name;
                } catch { /* ignore */ }
            }

            const strokeRef: import('./types').StrokeTokenRef = {
                ...colorRef,
                weight,
                ...(weightTokenName ? { weightTokenName } : {}),
            };
            result.stroke = strokeRef;
        }
    }

    // Corner radius token — scalar value
    if (bv.cornerRadius) {
        const ref = resolveTokenRef(bv.cornerRadius);
        if (ref) result.cornerRadius = ref;
    }

    return Object.keys(result).length > 0 ? result : undefined;
}

/** Returns the first visible Paint from fills or strokes of a node. */
function getFirstVisiblePaint(node: SceneNode, prop: 'fills' | 'strokes'): Paint | null {
    if (!(prop in node)) return null;
    const paints = (node as any)[prop];
    if (paints === figma.mixed) return null;
    return (paints as ReadonlyArray<Paint>).find((p) => p.visible !== false) ?? null;
}

/**
 * Build a TokenRef for a gradient fill/stroke.
 * Reads each gradient stop and resolves any bound variable for that stop.
 * `stopBindings` is the array from boundVariables.fills / boundVariables.strokes:
 *   each entry may have a `.color` VARIABLE_ALIAS for that stop.
 */
function buildGradientTokenRef(
    paint: GradientPaint,
    stopBindings: any[],
    gradType: string
): TokenRef | null {
    const stops: import('./types').GradientStop[] = paint.gradientStops.map((stop, i) => {
        const c = stop.color;
        const color: [number, number, number, number] = [
            Math.round(c.r * 1000) / 1000,
            Math.round(c.g * 1000) / 1000,
            Math.round(c.b * 1000) / 1000,
            Math.round((c.a ?? 1) * 1000) / 1000,
        ];
        const binding = stopBindings[i];
        const alias = binding?.color ?? (binding?.type === 'VARIABLE_ALIAS' ? binding : null);
        let tokenName: string | undefined;
        if (alias?.type === 'VARIABLE_ALIAS') {
            try {
                const v = figma.variables.getVariableById(alias.id);
                if (v) tokenName = v.name;
            } catch { /* ignore */ }
        }
        return tokenName ? { position: stop.position, color, tokenName } : { position: stop.position, color };
    });

    // Primary ref uses first stop that has a token, or first stop otherwise
    const primaryStop = stops.find((s) => s.tokenName) ?? stops[0];
    const primaryBinding = stopBindings.find((b) => (b?.color ?? b)?.type === 'VARIABLE_ALIAS');
    const primaryRef = primaryBinding ? resolveTokenRef(primaryBinding?.color ?? primaryBinding) : null;

    return {
        id: primaryRef?.id ?? '',
        name: primaryRef?.name ?? primaryStop?.tokenName ?? '',
        collection: primaryRef?.collection ?? '',
        value: primaryStop?.color ?? [0, 0, 0, 1],
        gradientType: gradType,
        gradientStops: stops,
    };
}

/** Maps Figma paint type to a compact gradient identifier, or null for SOLID. */
function gradientTypeFromPaintType(type: string): string | null {
    switch (type) {
        case 'GRADIENT_LINEAR':  return 'LINEAR';
        case 'GRADIENT_RADIAL':  return 'RADIAL';
        case 'GRADIENT_ANGULAR': return 'ANGULAR';
        case 'GRADIENT_DIAMOND': return 'DIAMOND';
        default: return null; // SOLID or IMAGE
    }
}

function resolveTokenRef(alias: any): TokenRef | null {
    if (!alias || alias.type !== 'VARIABLE_ALIAS') return null;

    try {
        const variable = figma.variables.getVariableById(alias.id);
        if (!variable) return null;

        const collection = figma.variables.getVariableCollectionById(variable.variableCollectionId);
        const collectionName = collection?.name ?? '';

        // Get default mode value
        const modeIds = Object.keys(variable.valuesByMode);
        const defaultModeId = collection?.defaultModeId ?? modeIds[0];
        const rawValue = variable.valuesByMode[defaultModeId ?? modeIds[0]];

        let value: number | [number, number, number, number];
        if (variable.resolvedType === 'COLOR' && rawValue && typeof rawValue === 'object') {
            const c = rawValue as RGBA;
            value = [
                Math.round((c as any).r * 1000) / 1000,
                Math.round((c as any).g * 1000) / 1000,
                Math.round((c as any).b * 1000) / 1000,
                (c as any).a ?? 1,
            ];
        } else {
            value = typeof rawValue === 'number' ? rawValue : 0;
        }

        return {
            id: alias.id,
            name: variable.name,
            collection: collectionName,
            value,
        };
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Exportable detection
// ---------------------------------------------------------------------------

export function isIconContainer(node: SceneNode): boolean {
    const validTypes = ['GROUP', 'FRAME', 'COMPONENT', 'INSTANCE'];
    if (validTypes.indexOf(node.type) < 0) return false;

    let isIcon = true;
    let hasVectorLeaf = false;
    function check(n: SceneNode) {
        if (!isIcon) return;

        // Skip invisible nodes — hidden bounding rects, guides, etc.
        if ('visible' in n && !n.visible) return;

        if (n.type === 'VECTOR' || n.type === 'BOOLEAN_OPERATION' || n.type === 'LINE'
            || n.type === 'ELLIPSE' || n.type === 'POLYGON' || n.type === 'STAR'
            || n.type === 'RECTANGLE') {
            hasVectorLeaf = true;
            return;
        }

        if (n.type === 'GROUP') {
            if (!('children' in n) || n.children.length === 0) {
                isIcon = false;
                return;
            }
            for (let i = 0; i < n.children.length; i++) {
                check(n.children[i]);
            }
            return;
        }

        if (n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'INSTANCE' || n.type === 'TEXT') {
            isIcon = false;
            return;
        }

        isIcon = false;
    }

    // An icon container must have children
    if (!('children' in node) || (node as ChildrenMixin).children.length === 0) return false;

    const parentNode = node as ChildrenMixin;
    for (var i = 0; i < parentNode.children.length; i++) {
        check(parentNode.children[i]);
    }
    return isIcon && hasVectorLeaf;
}

/**
 * Determine if a node should be exported as a PNG.
 *
 * Rules:
 * - TEXT                   → never (TMP in Unity)
 * - GROUP (non-icon)       → never
 * - VECTOR / bool ops      → always (raw shapes)
 * - RECTANGLE              → only if image/gradient fill (solid = Image color)
 * - FRAME / INSTANCE etc.  → only if image/gradient fill OR is an icon container
 *                            Solid fill + corner + stroke → described by style/tokens, no PNG
 */
function isExportable(node: SceneNode): boolean {
    if (node.type === 'TEXT') return false;

    if (node.type === 'GROUP') return isIconContainer(node);

    if (node.type === 'VECTOR' || node.type === 'BOOLEAN_OPERATION' || node.type === 'LINE'
        || node.type === 'ELLIPSE' || node.type === 'POLYGON' || node.type === 'STAR') return true;

    // Both RECTANGLE and container frames: export only if image/gradient fill
    // Solid color fills are rendered via Image.color + style data — no PNG needed
    return hasNonSolidFill(node);
}

/** True if node has at least one visible image or gradient fill. */
function hasNonSolidFill(node: SceneNode): boolean {
    if (!('fills' in node)) return false;
    const fills = (node as GeometryMixin).fills;
    if (fills === figma.mixed) return true;
    return (fills as ReadonlyArray<Paint>).some(
        (f) => f.visible !== false && (
            f.type === 'IMAGE' ||
            f.type === 'GRADIENT_LINEAR' ||
            f.type === 'GRADIENT_RADIAL' ||
            f.type === 'GRADIENT_ANGULAR' ||
            f.type === 'GRADIENT_DIAMOND'
        )
    );
}


export function hasVisibleStroke(node: SceneNode): boolean {
    if (!('strokes' in node)) return false;

    const strokes = (node as GeometryMixin).strokes;
    if (strokes === figma.mixed) return true;

    return (strokes as ReadonlyArray<Paint>).some(function (stroke) {
        return stroke.visible !== false && stroke.opacity !== 0;
    });
}

// ---------------------------------------------------------------------------
// Text property helpers
// ---------------------------------------------------------------------------

function getTextProperty<T, R>(
    textNode: TextNode,
    prop: string,
    extract: (value: T) => R,
    fallback: R
): R {
    try {
        const value = (textNode as any)[prop];
        if (value === figma.mixed) return fallback;
        return extract(value as T);
    } catch {
        return fallback;
    }
}

function getTextColorToken(textNode: TextNode): string | undefined {
    try {
        const bv = (textNode as any).boundVariables;
        if (!bv) return undefined;
        const fillBindings = bv.fills;
        if (!Array.isArray(fillBindings) || fillBindings.length === 0) return undefined;
        const alias = fillBindings[0]?.color ?? fillBindings[0];
        const ref = resolveTokenRef(alias);
        return ref?.name ?? undefined;
    } catch {
        return undefined;
    }
}

function getTextColor(textNode: TextNode): RGBA {
    try {
        const fills = textNode.fills;
        if (fills === figma.mixed || !Array.isArray(fills) || fills.length === 0) {
            return [1, 1, 1, 1];
        }
        // Figma fills render bottom-to-top: last visible solid fill = topmost
        let lastSolid: SolidPaint | undefined;
        for (const f of fills) {
            if (f.type === 'SOLID' && f.visible !== false) {
                lastSolid = f as SolidPaint;
            }
        }
        if (lastSolid) {
            return [
                Math.round(lastSolid.color.r * 1000) / 1000,
                Math.round(lastSolid.color.g * 1000) / 1000,
                Math.round(lastSolid.color.b * 1000) / 1000,
                lastSolid.opacity ?? 1,
            ];
        }
    } catch { /* fallback */ }
    return [1, 1, 1, 1];
}

function mapTextAlignment(textNode: TextNode): string {
    const hAlign = textNode.textAlignHorizontal;
    const vAlign = textNode.textAlignVertical;

    const vMap: Record<string, string> = {
        TOP: 'Top',
        CENTER: 'Middle',
        BOTTOM: 'Bottom',
    };
    const hMap: Record<string, string> = {
        LEFT: 'Left',
        CENTER: 'Center',
        RIGHT: 'Right',
        JUSTIFIED: 'Justified',
    };

    return `${vMap[vAlign] ?? 'Top'}${hMap[hAlign] ?? 'Left'}`;
}

function getLineHeight(textNode: TextNode): number | null {
    try {
        const lh = textNode.lineHeight;
        if (lh === figma.mixed) return null;
        if ((lh as any).unit === 'AUTO') return null;
        if ((lh as any).unit === 'PERCENT') return (lh as any).value / 100;
        if ((lh as any).unit === 'PIXELS') return (lh as any).value;
    } catch { /* ignore */ }
    return null;
}

function getLetterSpacing(textNode: TextNode): number | null {
    try {
        const ls = textNode.letterSpacing;
        if (ls === figma.mixed) return null;
        if ((ls as any).unit === 'PERCENT') return (ls as any).value / 100;
        if ((ls as any).unit === 'PIXELS') return (ls as any).value;
    } catch { /* ignore */ }
    return null;
}
