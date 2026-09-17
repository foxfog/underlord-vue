// src/renderer/utils/treeConnectors.js

/**
 * Standard SVG Marker configuration for arrowheads in tree canvases.
 * Markers are docked at the flat base of the arrowhead (refX: 1) with userSpaceOnUse units,
 * preventing thick stroke lines from protruding through the tip of the arrow.
 */
export const TREE_MARKER_CONFIG = {
	viewBox: '0 0 12 12',
	markerWidth: 11,
	markerHeight: 11,
	refX: 1,
	refY: 6,
	markerUnits: 'userSpaceOnUse',
	orient: 'auto',
	points: '1 2.2, 10.5 6, 1 9.8',
	arrowLength: 9
}

/**
 * Builds an SVG path string from parent (bottom) to child (top) in a bottom-up tree.
 *
 * Features:
 * 1. Base docking: path terminates at `endY = cY + arrowLength`, so the stroke ends
 *    at the base of the arrowhead and does not penetrate its sharp tip.
 * 2. Straight vertical segments: if parent and child share the same X column (|pX - cX| < 2),
 *    returns an exact line `M pX pY L cX endY` without Bézier waviness.
 * 3. Vertical lead-in: for curved paths, the Bézier curve ends 10px early, ending with
 *    a straight vertical segment `L cX endY` so the tangent entering the arrowhead
 *    is 100% perpendicular, preventing lines from slicing through the arrow from the side.
 *
 * @param {Object} params
 * @param {number} params.pX - Parent center X
 * @param {number} params.pY - Parent connector anchor Y (top edge of parent in bottom-up)
 * @param {number} params.cX - Child center X
 * @param {number} params.cY - Child connector anchor Y (bottom edge of child in bottom-up)
 * @param {number} [params.arrowLength=9] - Arrowhead length in pixels
 * @param {number} [params.leadInMax=10] - Max length of straight vertical lead-in segment
 * @param {number} [params.minCurveOffset=25] - Minimum Bézier control point offset
 * @returns {string} SVG path 'd' attribute
 */
export function buildBottomUpConnectorPath({
	pX,
	pY,
	cX,
	cY,
	arrowLength = TREE_MARKER_CONFIG.arrowLength,
	leadInMax = 10,
	minCurveOffset = 25
}) {
	const deltaY = pY - cY
	const endY = deltaY > arrowLength + 4 ? cY + arrowLength : cY
	const actualDeltaY = Math.abs(pY - endY)
	const curveOffset = Math.max(actualDeltaY * 0.45, minCurveOffset)

	// Pure vertical line when parent and child are aligned in same column
	if (Math.abs(pX - cX) < 2) {
		return `M ${pX} ${pY} L ${cX} ${endY}`
	}

	// Straight vertical lead-in before arrow base so curve enters arrow strictly from underneath
	const leadIn = Math.min(leadInMax, actualDeltaY * 0.2)
	const curveEndY = endY + leadIn
	return `M ${pX} ${pY} C ${pX} ${pY - curveOffset}, ${cX} ${curveEndY + curveOffset}, ${cX} ${curveEndY} L ${cX} ${endY}`
}
