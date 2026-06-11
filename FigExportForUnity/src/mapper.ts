// =============================================================================
// Mapper — Figma Constraints → Unity Anchors
// Based on ANCHOR_MAPPING.md
// =============================================================================

import type { FigmaElement, Rect, UnityTransform } from './types';

/**
 * Convert Figma constraints to Unity RectTransform values.
 *
 * Key differences between Figma and Unity coordinate systems:
 * - Figma Y-axis: down = positive
 * - Unity Y-axis: up = positive
 * → Y values must be flipped during conversion.
 */
export function mapConstraintsToAnchors(
    element: FigmaElement,
    parentRect: Rect
): UnityTransform {
    const h = element.constraints.horizontal;
    const v = element.constraints.vertical;
    const rect = element.rect;

    const anchorX = mapHorizontalAnchor(h);
    const anchorY = mapVerticalAnchor(v);

    const anchorMin: [number, number] = [anchorX.min, anchorY.min];
    const anchorMax: [number, number] = [anchorX.max, anchorY.max];
    const pivot = computePivot(anchorMin, anchorMax, element);

    // Universal offset formula (works for all constraint combinations):
    //   In Unity parent space (Y-up), element rect edges are:
    //     left   = rect.x
    //     right  = rect.x + rect.w
    //     bottom = parentH - rect.y - rect.h   (Y flipped from Figma)
    //     top    = parentH - rect.y
    //   offsetMin = (left, bottom) - anchorMin * parentSize
    //   offsetMax = (right, top)   - anchorMax * parentSize
    const left   = rect.x;
    const right  = rect.x + rect.w;
    const bottom = parentRect.h - rect.y - rect.h;
    const top    = parentRect.h - rect.y;

    const offsetMin: [number, number] = [
        left   - anchorMin[0] * parentRect.w,
        bottom - anchorMin[1] * parentRect.h,
    ];
    const offsetMax: [number, number] = [
        right - anchorMax[0] * parentRect.w,
        top   - anchorMax[1] * parentRect.h,
    ];

    const sizeDelta: [number, number] = [
        offsetMax[0] - offsetMin[0],
        offsetMax[1] - offsetMin[1],
    ];

    return {
        anchorMin,
        anchorMax,
        pivot,
        localScale: [1, 1, 1],
        sizeDelta,
        offsetMin,
        offsetMax,
    };
}

// ---------------------------------------------------------------------------
// Horizontal constraint → anchor X values
// ---------------------------------------------------------------------------

interface AnchorRange {
    min: number;
    max: number;
}

function mapHorizontalAnchor(constraint: string): AnchorRange {
    switch (constraint) {
        case 'MIN': return { min: 0, max: 0 }; // Pin left
        case 'MAX': return { min: 1, max: 1 }; // Pin right
        case 'CENTER': return { min: 0.5, max: 0.5 }; // Center
        case 'STRETCH': return { min: 0, max: 1 }; // Full width
        case 'SCALE': return { min: 0, max: 1 }; // Scale with parent (use stretch anchors)
        default: return { min: 0, max: 0 }; // Default: pin left
    }
}

// ---------------------------------------------------------------------------
// Vertical constraint → anchor Y values (Y-flipped!)
// ---------------------------------------------------------------------------

function mapVerticalAnchor(constraint: string): AnchorRange {
    // Figma Y-down → Unity Y-up: MIN (top) = 1, MAX (bottom) = 0
    switch (constraint) {
        case 'MIN':     return { min: 1, max: 1 };
        case 'MAX':     return { min: 0, max: 0 };
        case 'CENTER':  return { min: 0.5, max: 0.5 };
        case 'STRETCH': return { min: 0, max: 1 };
        case 'SCALE':   return { min: 0, max: 1 };
        default:        return { min: 1, max: 1 };
    }
}

// ---------------------------------------------------------------------------
// Pivot calculation
// ---------------------------------------------------------------------------

function computePivot(
    anchorMin: [number, number],
    anchorMax: [number, number],
    element: FigmaElement
): [number, number] {
    // Match pivot to anchor so the gizmo sits at the anchor point in the editor
    let pivotX = (anchorMin[0] + anchorMax[0]) / 2;
    let pivotY = (anchorMin[1] + anchorMax[1]) / 2;

    // Text horizontal alignment overrides pivot X
    if (element.text) {
        const align = element.text.alignment.toLowerCase();
        if (align.includes('left')) pivotX = 0;
        else if (align.includes('right')) pivotX = 1;
        else pivotX = 0.5;
    }

    return [pivotX, pivotY];
}

// ---------------------------------------------------------------------------
// Auto-Layout → Unity components suggestion
// ---------------------------------------------------------------------------

/**
 * Determine which Unity layout component to use based on Figma auto-layout.
 * DISABLED: Auto-layout components cause position conflicts in Unity.
 * All positioning is handled via fixed RectTransform offsets instead.
 */
export function getLayoutComponent(element: FigmaElement): string | null {
    return null;
}

/**
 * Determine which Unity components to add based on the element's type and content.
 */
export function determineComponents(element: FigmaElement): string[] {
    const components: string[] = [];

    if (element.type === 'TEXT') {
        components.push('TextMeshProUGUI');
    } else if (element.exportable || hasVisualFill(element)) {
        components.push('Image');
    }

    // Auto-layout components disabled — all positioning uses fixed RectTransform offsets

    // Button detection: interactive elements with "button" or "btn" in name
    const nameLower = element.name.toLowerCase();
    if (nameLower.includes('button') || nameLower.includes('btn')) {
        components.push('Button');
    }

    return components;
}

/**
 * Check if interactive: buttons, inputs, toggles, or explicitly named interactive elements.
 */
export function isInteractive(element: FigmaElement): boolean {
    const nameLower = element.name.toLowerCase();
    return (
        nameLower.includes('button') ||
        nameLower.includes('btn') ||
        nameLower.includes('input') ||
        nameLower.includes('toggle') ||
        nameLower.includes('checkbox') ||
        nameLower.includes('switch') ||
        nameLower.includes('slider') ||
        nameLower.includes('dropdown')
    );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasVisualFill(element: FigmaElement): boolean {
    if (!element.fills || element.fills === figma.mixed) return false;
    return (element.fills as ReadonlyArray<Paint>).some(
        (f) => f.visible !== false && f.opacity !== 0
    );
}
