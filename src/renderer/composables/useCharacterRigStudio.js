import { ref, computed, reactive, onUnmounted, getCurrentInstance } from 'vue'

export function useCharacterRigStudio() {
	// Active character selection
	const charactersList = ref([])
	const selectedCharacterId = ref('default')
	const isLoading = ref(false)
	const statusMessage = ref(null)
	let statusTimeout = null

	// Character data
	const characterValues = ref({})
	const bodyParts = reactive({})
	const availableImages = ref([])

	// View mode: 'default' (2D Visual Novel Rig) | 'isometric' (Isometric preview)
	const viewMode = ref('default')

	// Orientation & Perspective
	const orientation = ref('default') // 'default' (right) | 'inverted' (left)
	const isBackView = ref(false)
	const invertedSpriteOverrides = reactive({})
	const backSpriteOverrides = reactive({})

	// Scale, Height & Root Avatar Offset
	const characterScale = ref(1.0)
	const baseHeightCm = ref(175)
	const effectiveHeightCm = computed(() => Math.round(baseHeightCm.value * characterScale.value))
	const rootOffset = reactive({ x: 0, y: 0 })

	function adjustRootOffset(axis, delta) {
		rootOffset[axis] = Number((rootOffset[axis] + delta).toFixed(2))
	}

	function resetRootOffset() {
		rootOffset.x = 0
		rootOffset.y = 0
	}

	// Rig Selection
	const selectedPartName = ref('body')

	// Emotions System
	const EMOTIONS_LIST = [
		{ id: 'default', label: 'Нейтральная (Default)', icon: '😐' },
		{ id: 'happy', label: 'Радость (Happy)', icon: '😊' },
		{ id: 'angry', label: 'Злость (Angry)', icon: '😠' },
		{ id: 'sad', label: 'Печаль (Sad)', icon: '😢' },
		{ id: 'surprised', label: 'Удивление (Surprised)', icon: '😲' },
		{ id: 'smug', label: 'Ухмылка (Smug)', icon: '😏' },
		{ id: 'blush', label: 'Смущение (Blush)', icon: '😳' },
		{ id: 'wink', label: 'Подмигивание (Wink)', icon: '😉' }
	]
	const currentEmotion = ref('default')
	const emotionOverrides = reactive({}) // { [emotionId]: { [partName]: imagePath } }

	// Eye Direction System
	const eyeControlMode = ref('linked') // 'linked' | 'independent'
	const eyeLinkedOffset = reactive({ x: 0, y: 0 })
	const eyeLeftOffset = reactive({ x: 0, y: 0 })
	const eyeRightOffset = reactive({ x: 0, y: 0 })

	const EYE_PRESETS = [
		{ id: 'center', label: 'Прямо', icon: '🎯', left: { x: 0, y: 0 }, right: { x: 0, y: 0 } },
		{ id: 'camera', label: 'В камеру', icon: '📷', left: { x: 0, y: 0 }, right: { x: 0, y: 0 } },
		{ id: 'left', label: 'Влево', icon: '⬅️', left: { x: -0.9, y: 0 }, right: { x: -0.9, y: 0 } },
		{ id: 'right', label: 'Вправо', icon: '➡️', left: { x: 0.9, y: 0 }, right: { x: 0.9, y: 0 } },
		{ id: 'up', label: 'Вверх', icon: '⬆️', left: { x: 0, y: -0.9 }, right: { x: 0, y: -0.9 } },
		{ id: 'down', label: 'Вниз', icon: '⬇️', left: { x: 0, y: 0.9 }, right: { x: 0, y: 0.9 } },
		{ id: 'roll_eyes', label: 'Закатывает', icon: '🙄', left: { x: 0, y: -0.95 }, right: { x: 0, y: -0.95 } },
		{ id: 'ahegao', label: 'Ахегао', icon: '🤤', left: { x: -0.65, y: -0.85 }, right: { x: 0.65, y: -0.85 } },
		{ id: 'squint', label: 'Косится', icon: '🤪', left: { x: 0.85, y: 0 }, right: { x: -0.85, y: 0 } },
		{ id: 'avert', label: 'Отводит', icon: '🙈', left: { x: 0.8, y: 0.4 }, right: { x: 0.8, y: 0.4 } }
	]

	// Direct Rotation & Posing
	const partRotations = reactive({})
	const partPivots = reactive({})

	// Animation Sequencer
	const isPlaying = ref(false)
	const activeAnimation = ref(null)
	const animationSpeed = ref(1.0)
	let animFrameId = null
	let animStartTime = null

	const BUILTIN_ANIMATIONS = [
		{
			id: 'wave_hand',
			name: 'Махание рукой',
			icon: '👋',
			desc: 'Поднятие руки от плеча, колебание предплечья и ладони'
		},
		{
			id: 'cough',
			name: 'Кашель (Shake Head)',
			icon: '🤧',
			desc: 'Быстрое покачивание головы при кашле'
		},
		{
			id: 'breathing',
			name: 'Дыхание (Idle)',
			icon: '🫁',
			desc: 'Плавное покачивание и подъем корпуса'
		},
		{
			id: 'tremble',
			name: 'Дрожь (Tremble)',
			icon: '🥶',
			desc: 'Мелкое дрожание от холода или страха'
		},
		{
			id: 'nod',
			name: 'Кивок (Nod)',
			icon: '👍',
			desc: 'Наклон головы в знак согласия'
		},
		{
			id: 'head_shake',
			name: 'Отрицание',
			icon: '👎',
			desc: 'Поворот головы из стороны в сторону'
		}
	]

	// Notification helper
	function setStatus(text, type = 'success') {
		if (statusTimeout) clearTimeout(statusTimeout)
		statusMessage.value = { text, type }
		statusTimeout = setTimeout(() => {
			statusMessage.value = null
		}, 3500)
	}

	// File read/write abstractions
	async function readDataFile(relativePath) {
		if (typeof window !== 'undefined' && window.electronAPI?.dataEditor?.readFile) {
			const res = await window.electronAPI.dataEditor.readFile(relativePath)
			if (res.success && res.data) return res.data
			return null
		}
		try {
			const response = await fetch(`/data/${relativePath}?t=${Date.now()}`)
			if (response.ok) return await response.json()
		} catch (e) {
			// fallback
		}
		return null
	}

	async function writeDataFile(relativePath, data) {
		const rawData = JSON.parse(JSON.stringify(data))
		if (typeof window !== 'undefined' && window.electronAPI?.dataEditor?.writeFile) {
			const res = await window.electronAPI.dataEditor.writeFile(relativePath, rawData)
			if (!res.success) throw new Error(res.error || 'Ошибка записи файла')
			return res
		}
		console.warn(`[useCharacterRigStudio] Writing without Electron IPC: ${relativePath}`, rawData)
		return { success: true, simulated: true, path: relativePath }
	}

	// Scan images available for character
	async function scanCharacterImages(charId) {
		const imgs = []
		// Known default sprites
		const defaultFilenames = [
			'body.png',
			'belly.png',
			'head.png',
			'arm left.png',
			'arm2 left.png',
			'arm3 left.png',
			'arm right.png',
			'arm2 right.png',
			'arm3 right.png',
			'default.png',
			'isometric/char.png'
		]

		for (const fn of defaultFilenames) {
			imgs.push(`images/sprites/characters/${charId}/${fn}`)
			// Also add fallback from default folder if different
			if (charId !== 'default') {
				imgs.push(`images/sprites/characters/default/${fn}`)
			}
		}

		// Try to scan via Electron if available
		if (typeof window !== 'undefined' && window.electronAPI?.dataEditor?.listFiles) {
			try {
				const res = await window.electronAPI.dataEditor.listFiles(`../../public/images/sprites/characters/${charId}`)
				if (res.success && Array.isArray(res.files)) {
					for (const file of res.files) {
						if (/\.(png|jpe?g|webp|gif)$/i.test(file)) {
							const path = `images/sprites/characters/${charId}/${file}`
							if (!imgs.includes(path)) imgs.push(path)
						}
					}
				}
			} catch (e) {
				// ignore
			}
		}

		availableImages.value = Array.from(new Set(imgs))
	}

	// Initialize character list
	async function loadCharactersList() {
		let list = ['default', 'mc', 'momonga', 'albedo', 'enri', 'carne-chief']
		try {
			const reg = await readDataFile('characters/characters.json')
			if (reg && Array.isArray(reg.characters) && reg.characters.length > 0) {
				list = Array.from(new Set([...reg.characters]))
			}
		} catch (e) {
			// fallback
		}
		charactersList.value = list
		if (!charactersList.value.includes(selectedCharacterId.value)) {
			selectedCharacterId.value = charactersList.value[0] || 'default'
		}
	}

	// Load specific character
	async function selectCharacter(charId) {
		isLoading.value = true
		selectedCharacterId.value = charId
		try {
			await scanCharacterImages(charId)

			// Load values.json
			let values = await readDataFile(`characters/${charId}/values.json`)
			if (!values && charId !== 'default') {
				// fallback to default values
				values = await readDataFile('characters/default/values.json')
			}
			characterValues.value = values || { id: charId, name: charId, size: 1 }
			baseHeightCm.value = characterValues.value.height || characterValues.value.height_cm || 175
			characterScale.value = Number(characterValues.value.size ?? characterValues.value.scale ?? 1.0)
			rootOffset.x = Number(characterValues.value.root_offset?.x || 0)
			rootOffset.y = Number(characterValues.value.root_offset?.y || 0)

			// Load body.json
			let body = await readDataFile(`characters/${charId}/body.json`)
			if (!body) {
				if (charId === 'default') {
					// Default body fallback
					body = {
						body: { image: 'images/sprites/characters/default/body.png' },
						head: { image: 'images/sprites/characters/default/head.png', parent: 'body', offset: { x: 13, y: -26 } },
						arm_left: { image: 'images/sprites/characters/default/arm left.png', parent: 'body', offset: { x: 35, y: -17 } },
						arm2_left: { image: 'images/sprites/characters/default/arm2 left.png', parent: 'arm_left', offset: { x: 0, y: 83 } },
						arm3_left: { image: 'images/sprites/characters/default/arm3 left.png', parent: 'arm2_left', offset: { x: 58, y: 80 } },
						arm_right: { image: 'images/sprites/characters/default/arm right.png', parent: 'body', offset: { x: -13, y: -17 } },
						arm2_right: { image: 'images/sprites/characters/default/arm2 right.png', parent: 'arm_right', offset: { x: -61, y: 86 } },
						arm3_right: { image: 'images/sprites/characters/default/arm3 right.png', parent: 'arm2_right', offset: { x: -74, y: -77 } }
					}
				} else {
					// Check if single image exists
					body = {
						body: { image: `images/sprites/characters/${charId}/default.png` }
					}
				}
			}

			// Populate reactive bodyParts
			Object.keys(bodyParts).forEach((k) => delete bodyParts[k])
			Object.keys(partRotations).forEach((k) => delete partRotations[k])
			Object.keys(partPivots).forEach((k) => delete partPivots[k])

			for (const [name, part] of Object.entries(body)) {
				bodyParts[name] = {
					image: part.image || '',
					parent: part.parent || null,
					zindex: part.zindex ?? part['z-index'] ?? 0,
					offset: {
						x: part.offset?.x ?? 0,
						y: part.offset?.y ?? 0
					}
				}
				partRotations[name] = 0
				partPivots[name] = defaultPivotForPart(name)
			}

			if (!bodyParts[selectedPartName.value]) {
				selectedPartName.value = Object.keys(bodyParts)[0] || 'body'
			}

			stopAnimation()
		} catch (err) {
			console.error(`Ошибка загрузки персонажа ${charId}:`, err)
			setStatus(`Ошибка загрузки ${charId}: ${err.message}`, 'error')
		} finally {
			isLoading.value = false
		}
	}

	// Default rotation anchor points (pivots): strictly center (50%, 50%) for all parts
	function defaultPivotForPart(name) {
		return { x: 50, y: 50 }
	}

	// Add part
	function addBodyPart(name, parent = 'body', imagePath = '') {
		const cleanName = name.trim().replace(/\s+/g, '_')
		if (!cleanName) return
		if (bodyParts[cleanName]) {
			setStatus(`Часть ${cleanName} уже существует!`, 'error')
			return
		}
		const fallbackImg = imagePath || availableImages.value[0] || `images/sprites/characters/default/body.png`
		bodyParts[cleanName] = {
			image: fallbackImg,
			parent: parent || null,
			zindex: 0,
			offset: { x: 0, y: 0 }
		}
		partRotations[cleanName] = 0
		partPivots[cleanName] = defaultPivotForPart(cleanName)
		selectedPartName.value = cleanName
		setStatus(`Часть "${cleanName}" добавлена`)
	}

	// Remove part
	function removeBodyPart(name) {
		if (name === 'body') {
			setStatus('Нельзя удалить корневую часть body!', 'error')
			return
		}
		// Re-parent children to parent of deleted part
		const newParent = bodyParts[name]?.parent || null
		for (const [k, p] of Object.entries(bodyParts)) {
			if (p.parent === name) {
				p.parent = newParent
			}
		}
		delete bodyParts[name]
		delete partRotations[name]
		delete partPivots[name]
		if (selectedPartName.value === name) {
			selectedPartName.value = Object.keys(bodyParts)[0] || 'body'
		}
		setStatus(`Часть "${name}" удалена`)
	}

	// Split body into head and arms if only single body exists
	function decomposeSingleBody() {
		const charId = selectedCharacterId.value
		// Add head
		if (!bodyParts['head']) {
			bodyParts['head'] = {
				image: `images/sprites/characters/${charId}/head.png`,
				parent: 'body',
				zindex: 1,
				offset: { x: 13, y: -26 }
			}
			partRotations['head'] = 0
			partPivots['head'] = defaultPivotForPart('head')
		}
		// Add arm left
		if (!bodyParts['arm_left']) {
			bodyParts['arm_left'] = {
				image: `images/sprites/characters/${charId}/arm left.png`,
				parent: 'body',
				zindex: 1,
				offset: { x: 35, y: -17 }
			}
			partRotations['arm_left'] = 0
			partPivots['arm_left'] = defaultPivotForPart('arm_left')
		}
		// Add arm right
		if (!bodyParts['arm_right']) {
			bodyParts['arm_right'] = {
				image: `images/sprites/characters/${charId}/arm right.png`,
				parent: 'body',
				zindex: -1,
				offset: { x: -13, y: -17 }
			}
			partRotations['arm_right'] = 0
			partPivots['arm_right'] = defaultPivotForPart('arm_right')
		}
		setStatus('Тело разделено на составные части (голова, руки)!')
	}

	// Split arm further into arm2 (forearm) and arm3 (palm)
	function decomposeArm(side = 'left') {
		const charId = selectedCharacterId.value
		const parentArm = `arm_${side}`
		const arm2 = `arm2_${side}`
		const arm3 = `arm3_${side}`

		if (!bodyParts[arm2]) {
			bodyParts[arm2] = {
				image: `images/sprites/characters/${charId}/arm2 ${side}.png`,
				parent: parentArm,
				zindex: 0,
				offset: side === 'left' ? { x: 0, y: 83 } : { x: -61, y: 86 }
			}
			partRotations[arm2] = 0
			partPivots[arm2] = defaultPivotForPart(arm2)
		}

		if (!bodyParts[arm3]) {
			bodyParts[arm3] = {
				image: `images/sprites/characters/${charId}/arm3 ${side}.png`,
				parent: arm2,
				zindex: 0,
				offset: side === 'left' ? { x: 58, y: 80 } : { x: -74, y: -77 }
			}
			partRotations[arm3] = 0
			partPivots[arm3] = defaultPivotForPart(arm3)
		}
		setStatus(`Рука (${side}) разделена на плечо, предплечье и кисть!`)
	}

	// Eye Direction: apply preset
	function applyEyePreset(preset) {
		eyeLeftOffset.x = preset.left.x
		eyeLeftOffset.y = preset.left.y
		eyeRightOffset.x = preset.right.x
		eyeRightOffset.y = preset.right.y
		eyeLinkedOffset.x = preset.left.x
		eyeLinkedOffset.y = preset.left.y
	}

	// Eye Direction: sync linked
	function updateLinkedEyeOffset(x, y) {
		eyeLinkedOffset.x = x
		eyeLinkedOffset.y = y
		eyeLeftOffset.x = x
		eyeLeftOffset.y = y
		eyeRightOffset.x = x
		eyeRightOffset.y = y
	}

	// Emotion Sprite Override
	function setEmotion(emotionId) {
		currentEmotion.value = emotionId
	}

	function setEmotionOverride(emotionId, partName, imagePath) {
		if (!emotionOverrides[emotionId]) {
			emotionOverrides[emotionId] = {}
		}
		if (imagePath) {
			emotionOverrides[emotionId][partName] = imagePath
		} else {
			delete emotionOverrides[emotionId][partName]
		}
	}

	// Resolve image for a part with emotion and view overrides
	function getEffectivePartImage(partName) {
		// Back view override
		if (isBackView.value && backSpriteOverrides[partName]) {
			return backSpriteOverrides[partName]
		}
		// Inverted view override
		if (orientation.value === 'inverted' && invertedSpriteOverrides[partName]) {
			return invertedSpriteOverrides[partName]
		}
		// Emotion override
		if (currentEmotion.value !== 'default' && emotionOverrides[currentEmotion.value]?.[partName]) {
			return emotionOverrides[currentEmotion.value][partName]
		}
		return bodyParts[partName]?.image || ''
	}

	// Posing: reset
	function resetPose() {
		stopAnimation()
		for (const k in partRotations) {
			partRotations[k] = 0
		}
		for (const k in partPivots) {
			partPivots[k] = { x: 50, y: 50 }
		}
		eyeLeftOffset.x = 0
		eyeLeftOffset.y = 0
		eyeRightOffset.x = 0
		eyeRightOffset.y = 0
		eyeLinkedOffset.x = 0
		eyeLinkedOffset.y = 0
		setStatus('Поза сброшена в исходное положение')
	}

	// Animation Sequencer
	function playAnimation(animId) {
		stopAnimation()
		activeAnimation.value = animId
		isPlaying.value = true
		animStartTime = performance.now()

		function loop(timestamp) {
			if (!isPlaying.value) return
			const elapsed = (timestamp - animStartTime) / 1000 * animationSpeed.value
			stepAnimation(activeAnimation.value, elapsed)
			animFrameId = requestAnimationFrame(loop)
		}

		animFrameId = requestAnimationFrame(loop)
	}

	function stopAnimation() {
		isPlaying.value = false
		activeAnimation.value = null
		if (animFrameId) {
			cancelAnimationFrame(animFrameId)
			animFrameId = null
		}
		// Reset temporary rotations to base
		for (const k in partRotations) {
			partRotations[k] = 0
		}
	}

	function stepAnimation(animId, time) {
		switch (animId) {
			case 'wave_hand': {
				// Arm left raises up: base -60deg
				// Forearm arm2_left oscillates back and forth: -25deg to +25deg at ~4Hz
				// Arm3_left (palm) oscillating slightly
				const waveAngle = Math.sin(time * 6) * 28
				if (bodyParts['arm_left']) partRotations['arm_left'] = -55
				if (bodyParts['arm2_left']) partRotations['arm2_left'] = waveAngle
				if (bodyParts['arm3_left']) partRotations['arm3_left'] = Math.sin(time * 6 + 0.5) * 15
				// If right arm instead:
				if (!bodyParts['arm_left'] && bodyParts['arm_right']) {
					partRotations['arm_right'] = 55
					if (bodyParts['arm2_right']) partRotations['arm2_right'] = -waveAngle
				}
				break
			}
			case 'cough': {
				// Rapid shake head burst
				const burst = Math.sin(time * 14) * 8
				if (bodyParts['head']) {
					partRotations['head'] = burst
				}
				if (bodyParts['body']) {
					partRotations['body'] = Math.sin(time * 14) * 2
				}
				break
			}
			case 'breathing': {
				// Gentle rhythmic breathing
				const breath = Math.sin(time * 2) * 3
				if (bodyParts['body']) partRotations['body'] = breath * 0.5
				if (bodyParts['head']) partRotations['head'] = -breath * 0.3
				if (bodyParts['arm_left']) partRotations['arm_left'] = breath * 0.8
				if (bodyParts['arm_right']) partRotations['arm_right'] = -breath * 0.8
				break
			}
			case 'tremble': {
				// High frequency fine tremor
				const jitter = (Math.random() - 0.5) * 4
				for (const k in partRotations) {
					partRotations[k] = jitter
				}
				break
			}
			case 'nod': {
				// Head nod pitch
				const nodAngle = Math.sin(time * 4) > 0 ? Math.sin(time * 4) * 16 : 0
				if (bodyParts['head']) partRotations['head'] = nodAngle
				break
			}
			case 'head_shake': {
				// Head shake side to side
				const shakeAngle = Math.sin(time * 5) * 14
				if (bodyParts['head']) partRotations['head'] = shakeAngle
				break
			}
		}
	}

	// Export animation step to VN JSON
	function exportAnimationToJson(partName = selectedPartName.value) {
		const rot = partRotations[partName] || 0
		const step = {
			type: 'part-animate',
			character: selectedCharacterId.value,
			part: partName,
			styles: {
				transform: `rotate(${Math.round(rot)}deg)`,
				transition: 'transform 0.4s ease-in-out'
			},
			duration: 0.4
		}
		const jsonString = JSON.stringify(step, null, 2)
		if (navigator.clipboard?.writeText) {
			navigator.clipboard.writeText(jsonString)
			setStatus(`Шаг сценария для ${partName} скопирован в буфер обмена!`)
		}
		return jsonString
	}

	// Save body.json
	async function saveBodyJson() {
		const charId = selectedCharacterId.value
		const jsonToSave = {}
		for (const [name, p] of Object.entries(bodyParts)) {
			const item = { image: p.image }
			if (p.parent) item.parent = p.parent
			if (p.zindex !== 0 && p.zindex !== undefined) item.zindex = p.zindex
			if (name === 'body') {
				if (rootOffset.x !== 0 || rootOffset.y !== 0) {
					item.offset = { x: Number(rootOffset.x.toFixed(2)), y: Number(rootOffset.y.toFixed(2)) }
				}
			} else if (p.offset && (p.offset.x !== 0 || p.offset.y !== 0)) {
				item.offset = { x: Number(p.offset.x), y: Number(p.offset.y) }
			}
			jsonToSave[name] = item
		}

		try {
			await writeDataFile(`characters/${charId}/body.json`, jsonToSave)
			setStatus(`Файл characters/${charId}/body.json успешно сохранен!`)
		} catch (err) {
			console.error('Ошибка сохранения body.json:', err)
			setStatus(`Ошибка сохранения body.json: ${err.message}`, 'error')
		}
	}

	// Save values.json (with updated visual size / scale and root avatar offset, preserving canonical biometric height)
	async function saveValuesJson() {
		const charId = selectedCharacterId.value
		try {
			const scaledSize = Number(characterScale.value.toFixed(3))
			characterValues.value.size = scaledSize
			characterValues.value.scale = scaledSize
			characterValues.value.root_offset = {
				x: Number(rootOffset.x.toFixed(2)),
				y: Number(rootOffset.y.toFixed(2))
			}
			await writeDataFile(`characters/${charId}/values.json`, characterValues.value)
			setStatus(`Скейл (${scaledSize}x) и смещение аватара сохранены в values.json!`)
		} catch (err) {
			console.error('Ошибка сохранения values.json:', err)
			setStatus(`Ошибка сохранения values.json: ${err.message}`, 'error')
		}
	}

	if (getCurrentInstance()) {
		onUnmounted(() => {
			stopAnimation()
			if (statusTimeout) clearTimeout(statusTimeout)
		})
	}

	return {
		// State
		charactersList,
		selectedCharacterId,
		isLoading,
		statusMessage,
		characterValues,
		bodyParts,
		availableImages,
		selectedPartName,
		// View
		viewMode,
		orientation,
		isBackView,
		invertedSpriteOverrides,
		backSpriteOverrides,
		characterScale,
		baseHeightCm,
		effectiveHeightCm,
		rootOffset,
		adjustRootOffset,
		resetRootOffset,
		// Emotions
		EMOTIONS_LIST,
		currentEmotion,
		emotionOverrides,
		// Eye direction
		eyeControlMode,
		eyeLinkedOffset,
		eyeLeftOffset,
		eyeRightOffset,
		EYE_PRESETS,
		// Rotations & Posing
		partRotations,
		partPivots,
		// Animations
		BUILTIN_ANIMATIONS,
		isPlaying,
		activeAnimation,
		animationSpeed,
		// Methods
		loadCharactersList,
		selectCharacter,
		addBodyPart,
		removeBodyPart,
		decomposeSingleBody,
		decomposeArm,
		applyEyePreset,
		updateLinkedEyeOffset,
		setEmotion,
		setEmotionOverride,
		getEffectivePartImage,
		resetPose,
		playAnimation,
		stopAnimation,
		exportAnimationToJson,
		saveBodyJson,
		saveValuesJson,
		setStatus
	}
}
