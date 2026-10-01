/**
 * 2D Matrix and Scene Graph Renderer for Character Rig System
 * Implements center-based joint attachments, hierarchical world transforms,
 * decoupled Z-Index rendering, and hit-testing for the Underlord Character Rig.
 */

// 2D Affine Matrix: [a, b, c, d, e, f]
// x' = a*x + c*y + e
// y' = b*x + d*y + f

export function createIdentityMatrix() {
	return [1, 0, 0, 1, 0, 0]
}

export function multiplyMatrices(m1, m2) {
	return [
		m1[0] * m2[0] + m1[2] * m2[1],
		m1[1] * m2[0] + m1[3] * m2[1],
		m1[0] * m2[2] + m1[2] * m2[3],
		m1[1] * m2[2] + m1[3] * m2[3],
		m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
		m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
	]
}

export function translateMatrix(m, tx, ty) {
	return multiplyMatrices(m, [1, 0, 0, 1, tx, ty])
}

export function rotateMatrix(m, radians) {
	const cos = Math.cos(radians)
	const sin = Math.sin(radians)
	return multiplyMatrices(m, [cos, sin, -sin, cos, 0, 0])
}

export function scaleMatrix(m, sx, sy = sx) {
	return multiplyMatrices(m, [sx, 0, 0, sy, 0, 0])
}

export function skewXMatrix(m, radians) {
	return multiplyMatrices(m, [1, 0, Math.tan(radians), 1, 0, 0])
}

export function invertMatrix(m) {
	const [a, b, c, d, e, f] = m
	const det = a * d - b * c
	if (Math.abs(det) < 1e-8) return null
	const invDet = 1 / det
	return [
		d * invDet,
		-b * invDet,
		-c * invDet,
		a * invDet,
		(c * f - d * e) * invDet,
		(b * e - a * f) * invDet
	]
}

export function transformPoint(m, x, y) {
	return {
		x: m[0] * x + m[2] * y + m[4],
		y: m[1] * x + m[3] * y + m[5]
	}
}

// Global Image Cache to prevent flickering and avoid reloading
const imageCache = new Map()
const pendingLoads = new Map()

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
		bleed = { top: 0, bottom: 0, left: 0, right: 0 }
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
		// The studio stage-frame represents 240 cm ruler, where baseline character height is 72.917% (175 cm).
		// In game VN canvas, baseCharHeight is the target character height.
		const baseCharHeight = rulerHeight * 0.72917 * characterScale
		const globalScale = baseCharHeight / rootNaturalH

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
		let rootMatrix = createIdentityMatrix()
		rootMatrix = translateMatrix(rootMatrix, rootCenterX, rootCenterY)

		// Orientation flip (left/right)
		if (orientation === 'left' || orientation === 'inverted') {
			rootMatrix = scaleMatrix(rootMatrix, -1, 1)
		}

		// Recursive function to process node and its children
		const processNode = (name, partDef, parentMatrix, parentWidth, parentHeight, isEquip = false) => {
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

			// Matrix at attachment center
			let localMatrix = translateMatrix(parentMatrix, attachX, attachY)

			// Part translations (from posing/joystick/animations)
			const trans = partTranslations[name]
			if (trans && (trans.x || trans.y)) {
				// Translate relative to child size
				const tx = (nodeWidth * (trans.x || 0)) / 100
				const ty = (nodeHeight * (trans.y || 0)) / 100
				localMatrix = translateMatrix(localMatrix, tx, ty)
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
				const eyeX = off?.x ? (off.x * nodeWidth * 0.15) : 0
				const eyeY = off?.y ? (off.y * nodeHeight * 0.15) : 0
				if (eyeX || eyeY) {
					localMatrix = translateMatrix(localMatrix, eyeX, eyeY)
				}
			}

			// Part Rotation
			const rot = partRotations[name] || 0
			if (rot) {
				const rotRad = (rot * Math.PI) / 180
				if (isIsometric && isIsometricRotation) {
					if (isometricRotationMode === 'dimetric') {
						const tilt = Number(isometricTiltAngle) || 26.565
						const skewRad = -Math.sin(rotRad * 2) * (tilt * 0.55 * Math.PI / 180)
						const scaleYVal = 0.75 + 0.25 * Math.cos(rotRad)
						localMatrix = rotateMatrix(localMatrix, rotRad)
						localMatrix = skewXMatrix(localMatrix, skewRad)
						localMatrix = scaleMatrix(localMatrix, 1, scaleYVal)
					} else {
						// Standard 2D rotation fallback for canvas
						localMatrix = rotateMatrix(localMatrix, rotRad)
					}
				} else {
					localMatrix = rotateMatrix(localMatrix, rotRad)
				}
			}

			// Part Scale & 2D Perspective Deform (rotateX, rotateY, scale)
			const poseScale = partScales[name]
			const baseScale = isRoot ? 1 : (partDef.scale !== undefined ? Number(partDef.scale) : 1)

			let sx = 1
			let sy = 1

			if (typeof poseScale === 'number') {
				sx *= poseScale
				sy *= poseScale
			} else if (poseScale && typeof poseScale === 'object') {
				if (poseScale.scale !== undefined) {
					sx *= Number(poseScale.scale)
					sy *= Number(poseScale.scale)
				}
				if (poseScale.scaleX !== undefined) sx *= Number(poseScale.scaleX)
				if (poseScale.scaleY !== undefined) sy *= Number(poseScale.scaleY)
				if (poseScale.x !== undefined) sx *= Number(poseScale.x)
				if (poseScale.y !== undefined) sy *= Number(poseScale.y)
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

			if (baseScale !== 1) {
				sx *= baseScale
				sy *= baseScale
			}

			if (sx !== 1 || sy !== 1) {
				localMatrix = scaleMatrix(localMatrix, sx, sy)
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
			if (poseOpacity !== undefined && poseOpacity !== null) {
				opacity = Math.max(0, Math.min(1, Number(poseOpacity)))
			} else if (baseOpacity !== undefined && baseOpacity !== null) {
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
				partDef
			}

			this.computedNodes.set(name, nodeData)
			this.renderQueue.push(nodeData)

			// Process child body parts
			const children = childrenByParent.get(name) || []
			for (const childName of children) {
				const childDef = bodyParts[childName]
				if (childDef) {
					processNode(childName, childDef, localMatrix, nodeWidth, nodeHeight, false)
				}
			}

			// Process equipment attached to this part
			for (const eq of equipPartsList) {
				if (eq.parent === name) {
					processNode(eq.name, eq, localMatrix, nodeWidth, nodeHeight, true)
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
						ctx.save()
						ctx.setTransform(ca * dpr, cb * dpr, cc * dpr, cd * dpr, ce * dpr, cf * dpr)
						ctx.lineWidth = 2
						ctx.strokeStyle = '#f59e0b'
						ctx.strokeRect(-node.pivotPixelX, -node.pivotPixelY, node.width, node.height)
						ctx.restore()
					}
					if (showBoundingBoxes) {
						ctx.save()
						ctx.setTransform(ca * dpr, cb * dpr, cc * dpr, cd * dpr, ce * dpr, cf * dpr)
						ctx.lineWidth = 1
						ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)'
						ctx.strokeRect(-node.pivotPixelX, -node.pivotPixelY, node.width, node.height)
						ctx.restore()
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
				ctx.lineWidth = 2
				ctx.strokeStyle = '#f59e0b' // amber
				ctx.strokeRect(-node.pivotPixelX, -node.pivotPixelY, node.width, node.height)
			}

			if (showBoundingBoxes) {
				ctx.lineWidth = 1
				ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)' // emerald
				ctx.strokeRect(-node.pivotPixelX, -node.pivotPixelY, node.width, node.height)
			}

			ctx.restore()
		}

		ctx.setTransform(1, 0, 0, 1, 0, 0)
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
}
