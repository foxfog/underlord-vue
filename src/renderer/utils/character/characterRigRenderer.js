/**
 * 2D Matrix and Scene Graph Renderer for Character Rig System
 * Implements center-based joint attachments, hierarchical world transforms,
 * decoupled Z-Index rendering, and hit-testing for the Underlord Character Rig.
 */

// 2D Affine Matrix: [a, b, c, d, e, f]
// x' = a*x + c*y + e
// y' = b*x + d*y + f

export function createIdentityMatrix(out = null) {
	const target = out || [1, 0, 0, 1, 0, 0]
	target[0] = 1
	target[1] = 0
	target[2] = 0
	target[3] = 1
	target[4] = 0
	target[5] = 0
	return target
}

export function multiplyMatrices(m1, m2, out = null) {
	const a0 = m1[0], a1 = m1[1], a2 = m1[2], a3 = m1[3], a4 = m1[4], a5 = m1[5]
	const b0 = m2[0], b1 = m2[1], b2 = m2[2], b3 = m2[3], b4 = m2[4], b5 = m2[5]
	const target = out || new Array(6)
	target[0] = a0 * b0 + a2 * b1
	target[1] = a1 * b0 + a3 * b1
	target[2] = a0 * b2 + a2 * b3
	target[3] = a1 * b2 + a3 * b3
	target[4] = a0 * b4 + a2 * b5 + a4
	target[5] = a1 * b4 + a3 * b5 + a5
	return target
}

export function translateMatrix(m, tx, ty, out = null) {
	const target = out || new Array(6)
	target[0] = m[0]
	target[1] = m[1]
	target[2] = m[2]
	target[3] = m[3]
	target[4] = m[0] * tx + m[2] * ty + m[4]
	target[5] = m[1] * tx + m[3] * ty + m[5]
	return target
}

export function rotateMatrix(m, radians, out = null) {
	const cos = Math.cos(radians)
	const sin = Math.sin(radians)
	const a = m[0], b = m[1], c = m[2], d = m[3]
	const target = out || new Array(6)
	target[0] = a * cos + c * sin
	target[1] = b * cos + d * sin
	target[2] = a * -sin + c * cos
	target[3] = b * -sin + d * cos
	target[4] = m[4]
	target[5] = m[5]
	return target
}

export function scaleMatrix(m, sx, sy = sx, out = null) {
	const target = out || new Array(6)
	target[0] = m[0] * sx
	target[1] = m[1] * sx
	target[2] = m[2] * sy
	target[3] = m[3] * sy
	target[4] = m[4]
	target[5] = m[5]
	return target
}

export function skewXMatrix(m, radians, out = null) {
	const tan = Math.tan(radians)
	const a = m[0], b = m[1], c = m[2], d = m[3]
	const target = out || new Array(6)
	target[0] = a
	target[1] = b
	target[2] = a * tan + c
	target[3] = b * tan + d
	target[4] = m[4]
	target[5] = m[5]
	return target
}

export function invertMatrix(m, out = null) {
	const a = m[0], b = m[1], c = m[2], d = m[3], e = m[4], f = m[5]
	const det = a * d - b * c
	if (Math.abs(det) < 1e-8) return null
	const invDet = 1 / det
	const target = out || new Array(6)
	target[0] = d * invDet
	target[1] = -b * invDet
	target[2] = -c * invDet
	target[3] = a * invDet
	target[4] = (c * f - d * e) * invDet
	target[5] = (b * e - a * f) * invDet
	return target
}

export function transformPoint(m, x, y, out = null) {
	const px = m[0] * x + m[2] * y + m[4]
	const py = m[1] * x + m[3] * y + m[5]
	if (out) {
		out.x = px
		out.y = py
		return out
	}
	return { x: px, y: py }
}


// Global Image Cache to prevent flickering and avoid reloading
const imageCache = new Map()
const pendingLoads = new Map()

export function clearCharacterRigImageCache() {
	imageCache.clear()
	pendingLoads.clear()
}

export function getImageFromCache(src) {
	if (!src) return null
	const cached = imageCache.get(src)
	if (cached && cached.complete && cached.naturalWidth > 0) {
		return cached
	}
	return null
}

export function preloadImage(src, onLoaded = null) {
	if (!src) return Promise.resolve(null)
	if (typeof Image === 'undefined') return Promise.resolve(null)
	if (imageCache.has(src)) {
		const img = imageCache.get(src)
		if (img.complete && img.naturalWidth > 0) {
			if (onLoaded) onLoaded(img)
			return Promise.resolve(img)
		}
	}
	if (pendingLoads.has(src)) {
		return pendingLoads.get(src)
	}

	const promise = new Promise((resolve) => {
		const img = new Image()
		img.crossOrigin = 'anonymous'
		img.onload = () => {
			const finish = () => {
				imageCache.set(src, img)
				pendingLoads.delete(src)
				if (onLoaded) onLoaded(img)
				resolve(img)
			}
			if (typeof img.decode === 'function') {
				img.decode().then(finish).catch(finish)
			} else {
				finish()
			}
		}
		img.onerror = () => {
			pendingLoads.delete(src)
			resolve(null)
		}
		img.src = src
	})

	pendingLoads.set(src, promise)
	return promise
}

/**
 * Character Rig 2D Renderer
 */
export class CharacterRigRenderer {
	constructor() {
		this.computedNodes = new Map()
		this.renderQueue = []
		this.rootNode = null
		this.onNeedRedraw = null
		this.bleed = { top: 0, bottom: 0, left: 0, right: 0 }
		this.clipCanvas = null
		this.clipCtx = null
	}

	/**
	 * Resolves image path (handling root slashes)
	 */
	normalizeImagePath(imagePath) {
		if (!imagePath) return ''
		if (imagePath.startsWith('/') || imagePath.startsWith('http')) {
			return imagePath
		}
		return `/${imagePath}`
	}

	/**
	 * Collects all image paths referenced by bodyParts and equipment
	 */
	collectAllImagePaths({
		bodyParts = {},
		animatedSprites = {},
		equipmentBySlot = {},
		getEffectivePartImage = null
	} = {}) {
		const paths = new Set()
		const partNames = Object.keys(bodyParts)
		for (const name of partNames) {
			const part = bodyParts[name]
			const p = this.getPartImagePath(name, part, animatedSprites, getEffectivePartImage)
			if (p) paths.add(p)
		}
		if (equipmentBySlot && typeof equipmentBySlot === 'object') {
			for (const slotKey of Object.keys(equipmentBySlot)) {
				const equip = equipmentBySlot[slotKey]
				if (!equip || !equip.parts) continue
				equip.parts.forEach((eqPart) => {
					const p = this.normalizeImagePath(eqPart.image)
					if (p) paths.add(p)
				})
			}
		}
		return Array.from(paths)
	}

	/**
	 * Checks if all required images are already cached and complete
	 */
	areAllImagesLoaded(params = {}) {
		const paths = this.collectAllImagePaths(params)
		if (paths.length === 0) return true
		for (const src of paths) {
			const img = getImageFromCache(src)
			if (!img) return false
		}
		return true
	}

	/**
	 * Preloads all images for the character and resolves when all are decoded and ready
	 */
	preloadAllParts(params = {}) {
		const paths = this.collectAllImagePaths(params)
		if (paths.length === 0) return Promise.resolve([])
		return Promise.all(paths.map((p) => preloadImage(p)))
	}

	/**
	 * Traverses the body parts hierarchy and computes the 2D affine transformation matrices.
	 *
	 * Coordinate system:
	 * - Root part (typically 'body' or pelvis) is positioned at (canvasWidth / 2, baseGroundY)
	 * - All parts scale relative to the root body sprite natural height
	 * - Child attachment offset is calculated relative to parent center:
	 *     localAttachX = parentWidth * (offset.x / 200)
	 *     localAttachY = parentHeight * (offset.y / 200)
	 * - Rotations occur around the child's own center (or custom pivot)
	 * - Decoupled Z-Index ordering for rendering
	 */
	computeSceneGraph({
		bodyParts = {},
		width = 1920,
		height = 1080,
		characterScale = 1.0,
		rootOffset = { x: 0, y: 0 },
		orientation = 'right', // 'right' | 'left'
		partRotations = {},
		partScreenAngles = {},
		partTranslations = {},
		partScales = {},
		partOpacities = {},
		partPivots = {},
		animatedSprites = {},
		equipmentBySlot = {},
		eyeOffset = { x: 0, y: 0 },
		getEffectivePartImage = null,
		isIsometric = false,
		isIsometricRotation = true,
		isometricRotationMode = 'trapezoid',
		isometricTiltAngle = 26.565,
		bleed = { top: 0, bottom: 0, left: 0, right: 0 },
		preserveCanonicalRulerHeight = true
	}) {
		this.computedNodes.clear()
		this.renderQueue = []

		this.bleed = {
			top: Number(bleed?.top) || 0,
			bottom: Number(bleed?.bottom) || 0,
			left: Number(bleed?.left) || 0,
			right: Number(bleed?.right) || 0
		}

		const partNames = Object.keys(bodyParts)
		if (partNames.length === 0) return

		// Group parts by parent
		const childrenByParent = new Map()
		let rootPartName = 'body'

		for (const name of partNames) {
			const part = bodyParts[name]
			const parent = part.parent || null
			if (!parent || name === 'body') {
				rootPartName = name
			}
			if (!childrenByParent.has(parent)) {
				childrenByParent.set(parent, [])
			}
			childrenByParent.get(parent).push(name)
		}

		// Also collect equipment parts if provided
		const equipPartsList = []
		if (equipmentBySlot && typeof equipmentBySlot === 'object') {
			for (const slotKey of Object.keys(equipmentBySlot)) {
				const equip = equipmentBySlot[slotKey]
				if (!equip || !equip.parts) continue
				equip.parts.forEach((eqPart, idx) => {
					equipPartsList.push({
						name: `equip_${slotKey}_${idx}`,
						isEquipment: true,
						parent: eqPart.parent,
						image: eqPart.image,
						offset: eqPart.offset || { x: 0, y: 0 },
						zindex: eqPart.zindex !== undefined ? eqPart.zindex : equip.item?.zindex
					})
				})
			}
		}

		// Resolve root image
		const rootPart = bodyParts[rootPartName] || bodyParts[partNames[0]]
		const rootImgPath = this.getPartImagePath(rootPartName, rootPart, animatedSprites, getEffectivePartImage)
		const rootImg = getImageFromCache(rootImgPath)
		if (!rootImg) {
			preloadImage(rootImgPath, () => {
				if (this.onNeedRedraw) this.onNeedRedraw()
			})
		}

		const rootNaturalW = rootImg ? rootImg.naturalWidth : 300
		const rootNaturalH = rootImg ? rootImg.naturalHeight : 600

		const bleedTop = this.bleed.top
		const bleedBottom = this.bleed.bottom
		const bleedLeft = this.bleed.left
		const bleedRight = this.bleed.right

		// Canonical ruler dimensions (excluding bleed margins)
		const rulerHeight = Math.max(10, height - bleedTop - bleedBottom)
		const rulerWidth = Math.max(10, width - bleedLeft - bleedRight)

		// Target character height on canvas
		// In isometric mode, pixel art preserves 1:1 scale (multiplied by characterScale).
		// In 2D VN mode, the studio stage represents a 240 cm ruler, where baseline character height is 72.917% (175 cm).
		// When preserveCanonicalRulerHeight is true (default for scenes), character height is evaluated against full stage height.
		const scaleRulerHeight = preserveCanonicalRulerHeight && !isIsometric ? height : rulerHeight
		const baseCharHeight = isIsometric
			? rootNaturalH * characterScale
			: scaleRulerHeight * 0.72917 * characterScale
		const globalScale = isIsometric ? characterScale : baseCharHeight / rootNaturalH

		const rootWidth = rootNaturalW * globalScale
		const rootHeight = baseCharHeight

		// Ground Baseline (0 cm standing line):
		// In canvas coordinates, 0 cm is at (height - bleedBottom)
		const groundBaselineY = height - bleedBottom
		// Vertical axis (X: 0) is at the center of the canonical ruler: (bleedLeft + rulerWidth / 2)
		const centerAxisX = bleedLeft + rulerWidth / 2

		// Root anchor position:
		// Base center X is aligned with centerAxisX + rootOffset
		const rootCenterX = centerAxisX + (rootWidth * (rootOffset.x || 0)) / 100
		// Base center Y places the bottom of root at groundBaselineY (0 cm ground baseline)
		const rootCenterY = groundBaselineY - (rootHeight / 2) - (rootHeight * (rootOffset.y || 0)) / 100

		// Root base matrix
		const rootMatrix = createIdentityMatrix()
		translateMatrix(rootMatrix, rootCenterX, rootCenterY, rootMatrix)

		// Orientation flip (left/right)
		if (orientation === 'left' || orientation === 'inverted') {
			scaleMatrix(rootMatrix, -1, 1, rootMatrix)
		}

		// Recursive function to process node and its children
		const processNode = (name, partDef, parentMatrix, parentWidth, parentHeight, isEquip = false, parentScreenAngle = 0) => {
			const isRoot = !partDef.parent || name === rootPartName

			const imgPath = isEquip
				? this.normalizeImagePath(partDef.image)
				: this.getPartImagePath(name, partDef, animatedSprites, getEffectivePartImage)

			const img = getImageFromCache(imgPath)
			if (!img) {
				preloadImage(imgPath, () => {
					if (this.onNeedRedraw) this.onNeedRedraw()
				})
			}

			const natW = img ? img.naturalWidth : (isRoot ? rootNaturalW : 100)
			const natH = img ? img.naturalHeight : (isRoot ? rootNaturalH : 100)

			// Child dimensions scaled to match natural proportions
			const nodeWidth = natW * globalScale
			const nodeHeight = natH * globalScale

			// Attachment offset from parent's center
			let attachX = 0
			let attachY = 0

			if (isRoot) {
				// For root part, offset shifts the root anchor relative to its own rendered size
				const offX = partDef.offset?.x ?? 0
				const offY = partDef.offset?.y ?? 0
				attachX = (nodeWidth * offX) / 200
				attachY = (nodeHeight * offY) / 200
			} else if (parentWidth !== null && parentHeight !== null) {
				const offX = partDef.offset?.x ?? 0
				const offY = partDef.offset?.y ?? 0
				// Dividing by 200 means offset 100% reaches the edge of parent (+50% of parent dimensions)
				attachX = (parentWidth * offX) / 200
				attachY = (parentHeight * offY) / 200
			}

			// Matrix at attachment center (initial clone of parent with attachment offset)
			const localMatrix = translateMatrix(parentMatrix, attachX, attachY)

			// Part translations (from posing/joystick/animations)
			const trans = partTranslations[name]
			if (trans && (trans.x || trans.y)) {
				const txVal = Number(trans.x) || 0
				const tyVal = Number(trans.y) || 0
				if (isFinite(txVal) && isFinite(tyVal)) {
					const tx = (nodeWidth * txVal) / 100
					const ty = (nodeHeight * tyVal) / 100
					translateMatrix(localMatrix, tx, ty, localMatrix)
				}
			}

			// Eye joystick offset: ONLY for eyeballs (eyeball-left, eyeball-right, or parts with eyeball/pupil in name)
			const isEyeball = name.includes('eyeball') || name.includes('pupil')
			if (isEyeball) {
				const isLeft = name.includes('left')
				const isRight = name.includes('right')
				const off = (isLeft && eyeOffset?.left)
					? eyeOffset.left
					: (isRight && eyeOffset?.right)
						? eyeOffset.right
						: eyeOffset
				const eyeMultiplier = 0.35
				const eyeX = off?.x ? (off.x * nodeWidth * eyeMultiplier) : 0
				const eyeY = off?.y ? (off.y * nodeHeight * eyeMultiplier) : 0
				if (eyeX || eyeY) {
					translateMatrix(localMatrix, eyeX, eyeY, localMatrix)
				}
			}

			// Screen Angle (angle of the rotation plane relative to screen: 3/4 puppet view or limb depth angle)
			const rawDefScreenAngle = partDef.screenAngle ?? partDef.screen_angle ?? partDef.depthAngle
			const hasExplicitDefAngle = rawDefScreenAngle !== undefined && rawDefScreenAngle !== null && isFinite(rawDefScreenAngle)
			const baseScreenAngle = hasExplicitDefAngle ? Number(rawDefScreenAngle) : (parentScreenAngle || 0)
			const dynScreenAngle = Number(partScreenAngles[name]) || 0
			const effScreenAngle = baseScreenAngle + dynScreenAngle

			// Part Rotation (with optional 3D plane projection relative to screen)
			const rot = Number(partRotations[name]) || 0
			const hasScreenAngle = isFinite(effScreenAngle) && Math.abs(effScreenAngle) > 0.001

			if (isIsometric && isIsometricRotation) {
				if (rot && isFinite(rot)) {
					const rotRad = (rot * Math.PI) / 180
					if (isometricRotationMode === 'dimetric') {
						const tilt = Number(isometricTiltAngle) || 26.565
						const skewRad = -Math.sin(rotRad * 2) * (tilt * 0.55 * Math.PI / 180)
						const scaleYVal = 0.75 + 0.25 * Math.cos(rotRad)
						rotateMatrix(localMatrix, rotRad, localMatrix)
						skewXMatrix(localMatrix, skewRad, localMatrix)
						scaleMatrix(localMatrix, 1, scaleYVal, localMatrix)
					} else {
						// Standard 2D rotation fallback for canvas
						rotateMatrix(localMatrix, rotRad, localMatrix)
					}
				}
			} else if (hasScreenAngle && rot && isFinite(rot)) {
				// 3D rotation plane inclined relative to screen (e.g. 3/4 semi-turned body view)
				const clampedAngle = Math.max(-85, Math.min(85, effScreenAngle))
				const screenRad = (clampedAngle * Math.PI) / 180
				const cosAlpha = Math.max(0.08, Math.cos(screenRad))

				const rotRad = (rot * Math.PI) / 180
				const sinRot = Math.sin(rotRad)
				const cosRot = Math.cos(rotRad)
				// Project circular rotation from inclined plane onto 2D screen ellipse
				const projAngleRad = Math.atan2(sinRot * cosAlpha, cosRot)
				// Foreshortening of the limb length along its axis
				const foreshortenScale = Math.sqrt((sinRot * cosAlpha) ** 2 + cosRot ** 2)

				rotateMatrix(localMatrix, projAngleRad, localMatrix)
				scaleMatrix(localMatrix, 1, foreshortenScale, localMatrix)
			} else if (rot && isFinite(rot)) {
				const rotRad = (rot * Math.PI) / 180
				rotateMatrix(localMatrix, rotRad, localMatrix)
			}

			// Part Scale & 2D Perspective Deform (rotateX, rotateY, scale)
			const poseScale = partScales[name]
			const baseScale = isRoot ? 1 : (partDef.scale !== undefined && isFinite(partDef.scale) ? Number(partDef.scale) : 1)

			let sx = 1
			let sy = 1

			if (typeof poseScale === 'number' && isFinite(poseScale)) {
				sx *= poseScale
				sy *= poseScale
			} else if (poseScale && typeof poseScale === 'object') {
				if (typeof poseScale.scale === 'number' && isFinite(poseScale.scale)) {
					sx *= poseScale.scale
					sy *= poseScale.scale
				}
				if (typeof poseScale.scaleX === 'number' && isFinite(poseScale.scaleX) && poseScale.scaleX !== poseScale.scale) {
					sx *= poseScale.scaleX
				}
				if (typeof poseScale.scaleY === 'number' && isFinite(poseScale.scaleY) && poseScale.scaleY !== poseScale.scale) {
					sy *= poseScale.scaleY
				}
				if (typeof poseScale.x === 'number' && isFinite(poseScale.x)) sx *= poseScale.x
				if (typeof poseScale.y === 'number' && isFinite(poseScale.y)) sy *= poseScale.y
				// Eye perspective rotation: horizontal turn (yaw / rotateY) compresses X: cos(rotateY)
				if (poseScale.rotateY !== undefined || poseScale.rotY !== undefined) {
					const ry = (Number(poseScale.rotateY ?? poseScale.rotY) || 0) * Math.PI / 180
					sx *= Math.max(0.05, Math.abs(Math.cos(ry)))
				}
				// Eye perspective rotation: vertical turn (pitch / rotateX) compresses Y: cos(rotateX)
				if (poseScale.rotateX !== undefined || poseScale.rotX !== undefined) {
					const rx = (Number(poseScale.rotateX ?? poseScale.rotX) || 0) * Math.PI / 180
					sy *= Math.max(0.05, Math.abs(Math.cos(rx)))
				}
			}

			if (baseScale !== 1 && isFinite(baseScale)) {
				sx *= baseScale
				sy *= baseScale
			}

			if (!isFinite(sx) || sx <= 0) sx = 1
			if (!isFinite(sy) || sy <= 0) sy = 1

			if (sx !== 1 || sy !== 1) {
				scaleMatrix(localMatrix, sx, sy, localMatrix)
			}

			// Pivot (defaults to center 50%, 50%)
			const pivot = partPivots[name] || { x: 50, y: 50 }
			const pivotPixelX = (nodeWidth * (pivot.x ?? 50)) / 100
			const pivotPixelY = (nodeHeight * (pivot.y ?? 50)) / 100

			// Center point in world/canvas coordinates (for editor crosshairs / gizmos)
			const worldCenter = transformPoint(localMatrix, 0, 0)

			// Opacity
			const poseOpacity = partOpacities[name]
			const baseOpacity = partDef.opacity
			let opacity = 1
			if (poseOpacity !== undefined && poseOpacity !== null && isFinite(poseOpacity)) {
				opacity = Math.max(0, Math.min(1, Number(poseOpacity)))
			} else if (baseOpacity !== undefined && baseOpacity !== null && isFinite(baseOpacity)) {
				opacity = Math.max(0, Math.min(1, Number(baseOpacity)))
			}

			// Z-Index
			const zindex = partDef.zindex ?? partDef['z-index'] ?? (name === 'body' ? 0 : 0)

			const nodeData = {
				name,
				parentName: partDef.parent || null,
				clipToParent: Boolean(
					partDef.clipToParent ??
					partDef.clip ??
					partDef['clip_to_parent'] ??
					partDef['clip-to-parent'] ??
					(isEyeball && partDef.parent)
				),
				isEquipment: isEquip,
				isRoot,
				image: img,
				imagePath: imgPath,
				worldMatrix: localMatrix,
				worldCenter,
				width: nodeWidth,
				height: nodeHeight,
				pivotPixelX,
				pivotPixelY,
				pivot,
				opacity,
				zindex: Number(zindex) || 0,
				screenAngle: effScreenAngle,
				partDef
			}

			this.computedNodes.set(name, nodeData)
			this.renderQueue.push(nodeData)

			// Process child body parts
			const children = childrenByParent.get(name) || []
			for (const childName of children) {
				const childDef = bodyParts[childName]
				if (childDef) {
					processNode(childName, childDef, localMatrix, nodeWidth, nodeHeight, false, effScreenAngle)
				}
			}

			// Process equipment attached to this part
			for (const eq of equipPartsList) {
				if (eq.parent === name) {
					processNode(eq.name, eq, localMatrix, nodeWidth, nodeHeight, true, effScreenAngle)
				}
			}
		}

		// Start traversal from root part
		processNode(rootPartName, rootPart, rootMatrix, null, null, false)

		// Stable sort by Z-Index (ascending)
		this.renderQueue.sort((a, b) => a.zindex - b.zindex)
	}

	getPartImagePath(partName, partDef, animatedSprites, getEffectivePartImage) {
		if (animatedSprites && animatedSprites[partName]) {
			return this.normalizeImagePath(animatedSprites[partName])
		}
		if (typeof getEffectivePartImage === 'function') {
			const res = getEffectivePartImage(partName)
			if (res) return this.normalizeImagePath(res)
		}
		return this.normalizeImagePath(partDef?.image || '')
	}

	/**
	 * Draws all computed parts to the canvas context
	 */
	render(ctx, { clear = true, selectedPartName = null, showBoundingBoxes = false, dpr = 1, isIsometric = false } = {}) {
		if (clear) {
			ctx.setTransform(1, 0, 0, 1, 0, 0)
			ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
		}

		if (isIsometric) {
			ctx.imageSmoothingEnabled = false
		} else {
			ctx.imageSmoothingEnabled = true
			ctx.imageSmoothingQuality = 'high'
		}

		for (const node of this.renderQueue) {
			if (!node.image) continue
			if (node.opacity <= 0) continue

			const parentNode = (node.clipToParent && node.parentName)
				? this.computedNodes.get(node.parentName)
				: null

			if (parentNode && parentNode.image) {
				// Render clipped to parent's visible alpha mask (e.g. eyeball inside eye-sclera)
				if (!this.clipCanvas && typeof document !== 'undefined') {
					this.clipCanvas = document.createElement('canvas')
					this.clipCtx = this.clipCanvas.getContext('2d')
				}

				if (this.clipCanvas) {
					// Bounding box of parent in canvas coordinates to avoid massive full-screen blits
					const cx = (parentNode.worldCenter?.x ?? 0) * dpr
					const cy = (parentNode.worldCenter?.y ?? 0) * dpr
					const radius = Math.ceil(
						Math.max(parentNode.width, parentNode.height, node.width, node.height) * dpr * 1.5
					)
					const minX = Math.max(0, Math.floor(cx - radius))
					const minY = Math.max(0, Math.floor(cy - radius))
					const maxX = Math.min(ctx.canvas.width, Math.ceil(cx + radius))
					const maxY = Math.min(ctx.canvas.height, Math.ceil(cy + radius))
					const boxW = Math.max(1, maxX - minX)
					const boxH = Math.max(1, maxY - minY)

					if (this.clipCanvas.width < boxW || this.clipCanvas.height < boxH) {
						this.clipCanvas.width = Math.max(boxW, 256)
						this.clipCanvas.height = Math.max(boxH, 256)
					}

					this.clipCtx.setTransform(1, 0, 0, 1, 0, 0)
					this.clipCtx.clearRect(0, 0, boxW, boxH)

					if (isIsometric) {
						this.clipCtx.imageSmoothingEnabled = false
					} else {
						this.clipCtx.imageSmoothingEnabled = true
						this.clipCtx.imageSmoothingQuality = 'high'
					}

					// 1. Draw parent image to act as alpha mask (translated by -minX, -minY)
					const [pa, pb, pc, pd, pe, pf] = parentNode.worldMatrix
					this.clipCtx.setTransform(pa * dpr, pb * dpr, pc * dpr, pd * dpr, pe * dpr - minX, pf * dpr - minY)
					this.clipCtx.globalAlpha = 1
					this.clipCtx.drawImage(
						parentNode.image,
						-parentNode.pivotPixelX,
						-parentNode.pivotPixelY,
						parentNode.width,
						parentNode.height
					)

					// 2. Composite child with source-in: keeps child pixels ONLY where parent alpha > 0
					this.clipCtx.globalCompositeOperation = 'source-in'
					const [ca, cb, cc, cd, ce, cf] = node.worldMatrix
					this.clipCtx.setTransform(ca * dpr, cb * dpr, cc * dpr, cd * dpr, ce * dpr - minX, cf * dpr - minY)
					this.clipCtx.globalAlpha = node.opacity < 1 ? node.opacity : 1
					this.clipCtx.drawImage(
						node.image,
						-node.pivotPixelX,
						-node.pivotPixelY,
						node.width,
						node.height
					)

					// 3. Reset composite mode
					this.clipCtx.globalCompositeOperation = 'source-over'

					// 4. Blit clipped region onto main canvas
					ctx.save()
					ctx.setTransform(1, 0, 0, 1, 0, 0)
					ctx.drawImage(this.clipCanvas, 0, 0, boxW, boxH, minX, minY, boxW, boxH)
					ctx.restore()

					// Editor selection / bounding boxes
					if (selectedPartName && node.name === selectedPartName) {
						this.drawPartSelectionBox(ctx, node, dpr)
					}
					if (showBoundingBoxes) {
						this.drawBoundingBox(ctx, node, 'rgba(16, 185, 129, 0.4)', dpr)
					}
					continue
				}
			}

			ctx.save()

			// Apply 2D affine matrix multiplied by device pixel ratio (DPR)
			const [a, b, c, d, e, f] = node.worldMatrix
			ctx.setTransform(a * dpr, b * dpr, c * dpr, d * dpr, e * dpr, f * dpr)

			// Ensure smoothing mode is maintained within transformed state
			if (isIsometric) {
				ctx.imageSmoothingEnabled = false
			} else {
				ctx.imageSmoothingEnabled = true
				ctx.imageSmoothingQuality = 'high'
			}

			// Apply opacity
			if (node.opacity < 1) {
				ctx.globalAlpha = node.opacity
			}

			// Draw image centered at pivot: (-pivotPixelX, -pivotPixelY)
			ctx.drawImage(
				node.image,
				-node.pivotPixelX,
				-node.pivotPixelY,
				node.width,
				node.height
			)

			// Optional highlight for selected part in editor
			if (selectedPartName && node.name === selectedPartName) {
				this.drawPartSelectionBox(ctx, node, dpr)
			}

			if (showBoundingBoxes) {
				this.drawBoundingBox(ctx, node, 'rgba(16, 185, 129, 0.4)', dpr)
			}

			ctx.restore()
		}

		ctx.setTransform(1, 0, 0, 1, 0, 0)
	}

	/**
	 * Render 3D-perspective-aware selection gizmo for the currently selected part.
	 * When screenAngle is 0, renders a classic 2D rectangle.
	 * When screenAngle != 0, projects the 4 corners in true 3D perspective around the pivot:
	 * the side closer to the screen enlarges (p > 1), and the side farther shrinks (p < 1).
	 */
	drawPartSelectionBox(ctx, node, dpr = 1) {
		const [ma, mb, mc, md, me, mf] = node.worldMatrix
		const px = me
		const py = mf

		const x0 = -node.pivotPixelX
		const y0 = -node.pivotPixelY
		const w = node.width
		const h = node.height
		const x1 = x0 + w
		const y1 = y0 + h

		const screenAngle = Number(node.screenAngle) || 0

		ctx.save()
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
		ctx.globalAlpha = 1

		// 4 corners of the sprite in local unrotated space
		const localCorners = [
			{ x: x0, y: y0 }, // 0: top-left
			{ x: x1, y: y0 }, // 1: top-right
			{ x: x1, y: y1 }, // 2: bottom-right
			{ x: x0, y: y1 }  // 3: bottom-left
		]

		// 2D flat world coordinates on screen
		const fPts = localCorners.map(pt => ({
			x: ma * pt.x + mc * pt.y + px,
			y: mb * pt.x + md * pt.y + py
		}))

		if (Math.abs(screenAngle) < 0.5) {
			ctx.lineWidth = 2
			ctx.strokeStyle = '#f59e0b'
			ctx.beginPath()
			ctx.moveTo(fPts[0].x, fPts[0].y)
			ctx.lineTo(fPts[1].x, fPts[1].y)
			ctx.lineTo(fPts[2].x, fPts[2].y)
			ctx.lineTo(fPts[3].x, fPts[3].y)
			ctx.closePath()
			ctx.stroke()
			ctx.restore()
			return
		}

		// 3D Perspective Projection
		// Clamped angle in radians
		const clampedAngle = Math.max(-85, Math.min(85, screenAngle))
		const rad = (clampedAngle * Math.PI) / 180
		const sinA = Math.sin(rad)
		const cosA = Math.max(0.08, Math.cos(rad))

		// Center of the bounding box on screen
		const cx = (fPts[0].x + fPts[1].x + fPts[2].x + fPts[3].x) / 4
		const cy = (fPts[0].y + fPts[1].y + fPts[2].y + fPts[3].y) / 4

		// Characteristic dimension of the limb
		const S = Math.max(w, h, 80)
		// Camera focal distance scaled to limb dimensions for distinct, visible 3D perspective
		const D = S * 1.35 + 50

		// Project each corner in 3D relative to bounding box center:
		// dx is horizontal offset from center
		// Depth Z = -dx * sinA * 1.4: closer (>0) expands, farther (<0) shrinks
		const qPts = fPts.map(pt => {
			const dx = pt.x - cx
			const dy = pt.y - cy
			const z = -dx * sinA * 1.4
			const denom = Math.max(D * 0.25, D - z)
			const p = D / denom
			return {
				x: cx + (dx * cosA) * p,
				y: cy + dy * p,
				z
			}
		})

		// 1. Ghost reference box for flat 0° screen plane (baseline)
		ctx.lineWidth = 1
		ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)'
		ctx.setLineDash([4, 4])
		ctx.beginPath()
		ctx.moveTo(fPts[0].x, fPts[0].y)
		ctx.lineTo(fPts[1].x, fPts[1].y)
		ctx.lineTo(fPts[2].x, fPts[2].y)
		ctx.lineTo(fPts[3].x, fPts[3].y)
		ctx.closePath()
		ctx.stroke()

		// 2. Depth connecting lines from flat corners to 3D perspective corners
		ctx.lineWidth = 1
		ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)'
		ctx.setLineDash([2, 3])
		ctx.beginPath()
		for (let i = 0; i < 4; i++) {
			ctx.moveTo(fPts[i].x, fPts[i].y)
			ctx.lineTo(qPts[i].x, qPts[i].y)
		}
		ctx.stroke()

		// 3. 3D Perspective Plane Quad
		ctx.setLineDash([])
		ctx.beginPath()
		ctx.moveTo(qPts[0].x, qPts[0].y)
		ctx.lineTo(qPts[1].x, qPts[1].y)
		ctx.lineTo(qPts[2].x, qPts[2].y)
		ctx.lineTo(qPts[3].x, qPts[3].y)
		ctx.closePath()

		// Subtle translucent amber fill
		ctx.fillStyle = 'rgba(245, 158, 11, 0.08)'
		ctx.fill()

		// Solid 2px amber border
		ctx.lineWidth = 2
		ctx.strokeStyle = '#f59e0b'
		ctx.stroke()

		// 4. Corner vertex handles on the 3D plane
		ctx.fillStyle = '#f59e0b'
		for (const pt of qPts) {
			ctx.beginPath()
			ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2)
			ctx.fill()
		}

		// 5. Angle badge at the top edge of the 3D plane (drawn horizontally in screen space)
		const topX = (qPts[0].x + qPts[1].x) / 2
		const topY = Math.min(qPts[0].y, qPts[1].y, qPts[2].y, qPts[3].y)
		const badgeText = `${Math.round(screenAngle)}°`

		ctx.font = 'bold 11px monospace'
		ctx.textAlign = 'center'
		ctx.textBaseline = 'bottom'
		const badgeW = ctx.measureText(badgeText).width + 10
		const badgeH = 15
		const badgeY = topY - 6

		ctx.fillStyle = 'rgba(15, 23, 42, 0.88)'
		ctx.fillRect(topX - badgeW / 2, badgeY - badgeH, badgeW, badgeH)
		ctx.lineWidth = 1
		ctx.strokeStyle = '#f59e0b'
		ctx.strokeRect(topX - badgeW / 2, badgeY - badgeH, badgeW, badgeH)
		ctx.fillStyle = '#f59e0b'
		ctx.fillText(badgeText, topX, badgeY - 2)

		ctx.restore()
	}

	/**
	 * Render part bounding box (for showBoundingBoxes mode), supporting 3D perspective if screenAngle is set.
	 */
	drawBoundingBox(ctx, node, color = 'rgba(16, 185, 129, 0.4)', dpr = 1) {
		const [ma, mb, mc, md, me, mf] = node.worldMatrix
		const px = me
		const py = mf

		const x0 = -node.pivotPixelX
		const y0 = -node.pivotPixelY
		const w = node.width
		const h = node.height
		const x1 = x0 + w
		const y1 = y0 + h

		const screenAngle = Number(node.screenAngle) || 0

		ctx.save()
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

		const localCorners = [
			{ x: x0, y: y0 },
			{ x: x1, y: y0 },
			{ x: x1, y: y1 },
			{ x: x0, y: y1 }
		]

		const fPts = localCorners.map(pt => ({
			x: ma * pt.x + mc * pt.y + px,
			y: mb * pt.x + md * pt.y + py
		}))

		ctx.lineWidth = 1
		ctx.strokeStyle = color

		if (Math.abs(screenAngle) < 0.5) {
			ctx.beginPath()
			ctx.moveTo(fPts[0].x, fPts[0].y)
			ctx.lineTo(fPts[1].x, fPts[1].y)
			ctx.lineTo(fPts[2].x, fPts[2].y)
			ctx.lineTo(fPts[3].x, fPts[3].y)
			ctx.closePath()
			ctx.stroke()
			ctx.restore()
			return
		}

		const clampedAngle = Math.max(-85, Math.min(85, screenAngle))
		const rad = (clampedAngle * Math.PI) / 180
		const sinA = Math.sin(rad)
		const cosA = Math.max(0.08, Math.cos(rad))

		const cx = (fPts[0].x + fPts[1].x + fPts[2].x + fPts[3].x) / 4
		const cy = (fPts[0].y + fPts[1].y + fPts[2].y + fPts[3].y) / 4

		const S = Math.max(w, h, 80)
		const D = S * 1.35 + 50

		const qPts = fPts.map(pt => {
			const dx = pt.x - cx
			const dy = pt.y - cy
			const z = -dx * sinA * 1.4
			const denom = Math.max(D * 0.25, D - z)
			const p = D / denom
			return {
				x: cx + (dx * cosA) * p,
				y: cy + dy * p
			}
		})

		ctx.beginPath()
		ctx.moveTo(qPts[0].x, qPts[0].y)
		ctx.lineTo(qPts[1].x, qPts[1].y)
		ctx.lineTo(qPts[2].x, qPts[2].y)
		ctx.lineTo(qPts[3].x, qPts[3].y)
		ctx.closePath()
		ctx.stroke()
		ctx.restore()
	}

	/**
	 * Hit test to determine which part is at the given canvas coordinate (x, y)
	 * Checks in reverse render order (top-most z-index first).
	 */
	hitTest(x, y) {
		// Iterate from topmost to bottommost
		for (let i = this.renderQueue.length - 1; i >= 0; i--) {
			const node = this.renderQueue[i]
			if (node.isEquipment) continue
			if (node.opacity <= 0) continue

			const inv = invertMatrix(node.worldMatrix)
			if (!inv) continue

			const local = transformPoint(inv, x, y)
			const left = -node.pivotPixelX
			const top = -node.pivotPixelY
			const right = left + node.width
			const bottom = top + node.height

			if (local.x >= left && local.x <= right && local.y >= top && local.y <= bottom) {
				if (node.clipToParent && node.parentName) {
					const parentNode = this.computedNodes.get(node.parentName)
					if (parentNode) {
						const parentInv = invertMatrix(parentNode.worldMatrix)
						if (parentInv) {
							const pLocal = transformPoint(parentInv, x, y)
							const pLeft = -parentNode.pivotPixelX
							const pTop = -parentNode.pivotPixelY
							const pRight = pLeft + parentNode.width
							const pBottom = pTop + parentNode.height
							if (pLocal.x < pLeft || pLocal.x > pRight || pLocal.y < pTop || pLocal.y > pBottom) {
								continue
							}
						}
					}
				}
				return node.name
			}
		}
		return null
	}

	/**
	 * Returns array of all computed part center positions in canvas coordinates.
	 * If relativeToStage is true, subtracts bleed offsets to match canonical stage-frame coordinates.
	 */
	getPartCenters({ relativeToStage = false } = {}) {
		const centers = []
		const ox = relativeToStage ? (this.bleed?.left || 0) : 0
		const oy = relativeToStage ? (this.bleed?.top || 0) : 0
		for (const [name, node] of this.computedNodes) {
			if (node.isEquipment) continue
			centers.push({
				name,
				x: node.worldCenter.x - ox,
				y: node.worldCenter.y - oy,
				isRoot: node.isRoot,
				zindex: node.zindex
			})
		}
		return centers
	}

	/**
	 * Releases cached nodes, queues, and offscreen canvas buffer
	 */
	destroy() {
		this.computedNodes.clear()
		this.renderQueue.length = 0
		this.rootNode = null
		this.onNeedRedraw = null
		if (this.clipCanvas) {
			this.clipCanvas.width = 0
			this.clipCanvas.height = 0
			this.clipCanvas = null
			this.clipCtx = null
		}
	}
}
