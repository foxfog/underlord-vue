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

	// Direct Rotation, Translation, Scaling & Styling
	const partRotations = reactive({})
	const partTranslations = reactive({})
	const partScales = reactive({})
	const partCustomStyles = reactive({})
	const animatedSprites = reactive({})
	const partPivots = reactive({})

	// Animation Sequencer & Custom Animations
	const isPlaying = ref(false)
	const activeAnimation = ref(null)
	const animationSpeed = ref(1.0)
	let animFrameId = null
	let animStartTime = null

	const customAnimations = ref([])
	const selectedAnimationGroup = ref('all')

	const BUILTIN_ANIMATIONS = [
		{
			id: 'wave_hand',
			name: 'Махание рукой',
			icon: '👋',
			group: 'Базовые',
			desc: 'Поднятие руки от плеча, колебание предплечья и ладони',
			duration: 1.0,
			repeat: 'loop',
			timingMode: 'timeline',
			tracks: [
				{
					target: 'arm_left',
					targetMode: 'single',
					keyframes: [
						{ time: 0, transform: { rotate: 0, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' },
						{ time: 0.2, transform: { rotate: -55, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-out' },
						{ time: 1.0, transform: { rotate: -55, translateX: 0, translateY: 0, scale: 1 }, easing: 'linear' }
					]
				},
				{
					target: 'arm2_left',
					targetMode: 'single',
					keyframes: [
						{ time: 0, transform: { rotate: 0, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' },
						{ time: 0.3, transform: { rotate: -28, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' },
						{ time: 0.55, transform: { rotate: 28, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' },
						{ time: 0.8, transform: { rotate: -28, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' },
						{ time: 1.0, transform: { rotate: 28, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' }
					]
				},
				{
					target: 'arm3_left',
					targetMode: 'single',
					keyframes: [
						{ time: 0, transform: { rotate: 0, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' },
						{ time: 0.35, transform: { rotate: -15, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' },
						{ time: 0.65, transform: { rotate: 15, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' },
						{ time: 1.0, transform: { rotate: -15, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' }
					]
				}
			]
		},
		{
			id: 'cough',
			name: 'Кашель / Чих (Cough)',
			icon: '🤧',
			group: 'Базовые',
			desc: 'Смещение головы и наклон шеи при кашле (как в интро)',
			duration: 1.3,
			repeat: 'loop',
			timingMode: 'timeline',
			tracks: [
				{
					target: 'head',
					targetMode: 'single',
					keyframes: [
						{ time: 0,    transform: { rotate: 0, translateX: 0,    translateY: 0,   scale: 1 }, easing: 'ease-in-out' },
						{ time: 0.12, transform: { rotate: -3, translateX: -2.5, translateY: 3,   scale: 1 }, easing: 'ease-out' },
						{ time: 0.25, transform: { rotate: 0, translateX: 0,    translateY: 0,   scale: 1 }, easing: 'ease-in-out' },
						{ time: 0.37, transform: { rotate: -3, translateX: -2.5, translateY: 3,   scale: 1 }, easing: 'ease-out' },
						{ time: 0.5,  transform: { rotate: 0, translateX: 0,    translateY: 0,   scale: 1 }, easing: 'ease-in-out' },
						{ time: 1.3,  transform: { rotate: 0, translateX: 0,    translateY: 0,   scale: 1 }, easing: 'linear' }
					]
				},
				{
					target: 'neck',
					targetMode: 'single',
					keyframes: [
						{ time: 0,    transform: { rotate: 0,  translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' },
						{ time: 0.25, transform: { rotate: -8, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-out' },
						{ time: 0.5,  transform: { rotate: 0,  translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' },
						{ time: 1.3,  transform: { rotate: 0,  translateX: 0, translateY: 0, scale: 1 }, easing: 'linear' }
					]
				}
			]
		},
		{
			id: 'breathing',
			name: 'Дыхание (Idle)',
			icon: '🫁',
			group: 'Базовые',
			desc: 'Плавное покачивание и подъем корпуса',
			duration: 3.14,
			repeat: 'loop',
			timingMode: 'timeline',
			tracks: [
				{
					target: 'body',
					targetMode: 'single',
					keyframes: [
						{ time: 0,    transform: { rotate: 0,   translateX: 0, translateY: 0,  scale: 1 }, easing: 'ease-in-out' },
						{ time: 0.78, transform: { rotate: 1.5, translateX: 0, translateY: -1, scale: 1 }, easing: 'ease-in-out' },
						{ time: 1.57, transform: { rotate: 0,   translateX: 0, translateY: 0,  scale: 1 }, easing: 'ease-in-out' },
						{ time: 2.35, transform: { rotate: 1.5, translateX: 0, translateY: -1, scale: 1 }, easing: 'ease-in-out' },
						{ time: 3.14, transform: { rotate: 0,   translateX: 0, translateY: 0,  scale: 1 }, easing: 'ease-in-out' }
					]
				},
				{
					target: 'head',
					targetMode: 'single',
					keyframes: [
						{ time: 0,    transform: { rotate: 0,    translateX: 0, translateY: 0,    scale: 1 }, easing: 'ease-in-out' },
						{ time: 0.78, transform: { rotate: -0.9, translateX: 0, translateY: 0.3,  scale: 1 }, easing: 'ease-in-out' },
						{ time: 1.57, transform: { rotate: 0,    translateX: 0, translateY: 0,    scale: 1 }, easing: 'ease-in-out' },
						{ time: 2.35, transform: { rotate: -0.9, translateX: 0, translateY: 0.3,  scale: 1 }, easing: 'ease-in-out' },
						{ time: 3.14, transform: { rotate: 0,    translateX: 0, translateY: 0,    scale: 1 }, easing: 'ease-in-out' }
					]
				},
				{
					target: 'arm_left',
					targetMode: 'single',
					keyframes: [
						{ time: 0,    transform: { rotate: 0,   translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' },
						{ time: 0.78, transform: { rotate: 2.4, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' },
						{ time: 1.57, transform: { rotate: 0,   translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' },
						{ time: 2.35, transform: { rotate: 2.4, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' },
						{ time: 3.14, transform: { rotate: 0,   translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' }
					]
				},
				{
					target: 'arm_right',
					targetMode: 'single',
					keyframes: [
						{ time: 0,    transform: { rotate: 0,    translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' },
						{ time: 0.78, transform: { rotate: -2.4, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' },
						{ time: 1.57, transform: { rotate: 0,    translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' },
						{ time: 2.35, transform: { rotate: -2.4, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' },
						{ time: 3.14, transform: { rotate: 0,    translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' }
					]
				}
			]
		},
		{
			id: 'tremble',
			name: 'Дрожь (Tremble)',
			icon: '🥶',
			group: 'Базовые',
			desc: 'Мелкое дрожание от холода или страха',
			duration: 0.1,
			repeat: 'loop',
			timingMode: 'timeline',
			tracks: [
				{
					target: 'body',
					targetMode: 'hierarchy',
					keyframes: [
						{ time: 0,    transform: { rotate: -2, translateX: -1, translateY: 0, scale: 1 }, easing: 'step' },
						{ time: 0.05, transform: { rotate: 2,  translateX: 1,  translateY: 0, scale: 1 }, easing: 'step' },
						{ time: 0.1,  transform: { rotate: -2, translateX: -1, translateY: 0, scale: 1 }, easing: 'step' }
					]
				}
			]
		},
		{
			id: 'nod',
			name: 'Кивок (Nod)',
			icon: '👍',
			group: 'Базовые',
			desc: 'Наклон головы в знак согласия',
			duration: 0.5,
			repeat: 'count',
			repeatCount: 2,
			timingMode: 'timeline',
			tracks: [
				{
					target: 'head',
					targetMode: 'single',
					keyframes: [
						{ time: 0,    transform: { rotate: 0,  translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' },
						{ time: 0.2,  transform: { rotate: 16, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-out' },
						{ time: 0.5,  transform: { rotate: 0,  translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' }
					]
				},
				{
					target: 'neck',
					targetMode: 'single',
					keyframes: [
						{ time: 0,    transform: { rotate: 0, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' },
						{ time: 0.2,  transform: { rotate: 8, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-out' },
						{ time: 0.5,  transform: { rotate: 0, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' }
					]
				}
			]
		},
		{
			id: 'head_shake',
			name: 'Отрицание',
			icon: '👎',
			group: 'Базовые',
			desc: 'Поворот головы из стороны в сторону',
			duration: 0.4,
			repeat: 'count',
			repeatCount: 2,
			timingMode: 'timeline',
			tracks: [
				{
					target: 'head',
					targetMode: 'single',
					keyframes: [
						{ time: 0,    transform: { rotate: 0,   translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' },
						{ time: 0.1,  transform: { rotate: -14, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' },
						{ time: 0.2,  transform: { rotate: 14,  translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' },
						{ time: 0.3,  transform: { rotate: -14, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' },
						{ time: 0.4,  transform: { rotate: 0,   translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' }
					]
				}
			]
		}
	]


	const allAnimations = computed(() => {
		return [...BUILTIN_ANIMATIONS, ...customAnimations.value]
	})

	const animationGroups = computed(() => {
		const set = new Set(['all', 'Базовые'])
		customAnimations.value.forEach((a) => {
			if (a.group) set.add(a.group)
		})
		return Array.from(set)
	})

	const filteredAnimations = computed(() => {
		if (selectedAnimationGroup.value === 'all') {
			return allAnimations.value
		}
		return allAnimations.value.filter((a) => a.group === selectedAnimationGroup.value)
	})

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

			await loadAnimationsJson(charId)

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

	// Rig tree helper: recursively get all child part names
	function getDescendants(rootPartName) {
		const result = []
		function traverse(parent) {
			for (const [name, p] of Object.entries(bodyParts)) {
				if (p.parent === parent) {
					result.push(name)
					traverse(name)
				}
			}
		}
		traverse(rootPartName)
		return result
	}

	// Posing: reset
	function resetPose() {
		stopAnimation()
		for (const k in partRotations) {
			partRotations[k] = 0
		}
		for (const k in partTranslations) {
			partTranslations[k] = { x: 0, y: 0 }
		}
		for (const k in partScales) {
			partScales[k] = 1
		}
		for (const k in partCustomStyles) {
			delete partCustomStyles[k]
		}
		for (const k in animatedSprites) {
			delete animatedSprites[k]
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

	// Custom animations persistence (characters/[charId]/animations.json)
	async function loadAnimationsJson(charId = selectedCharacterId.value) {
		try {
			const data = await readDataFile(`characters/${charId}/animations.json`)
			if (data && Array.isArray(data)) {
				customAnimations.value = data
			} else if (data && Array.isArray(data.animations)) {
				customAnimations.value = data.animations
			} else {
				customAnimations.value = []
			}
		} catch (err) {
			console.warn(`[useCharacterRigStudio] No animations.json for ${charId}:`, err)
			customAnimations.value = []
		}
	}

	async function saveAnimationsJson() {
		const charId = selectedCharacterId.value
		const rawPayload = JSON.parse(JSON.stringify(customAnimations.value))
		const success = await writeDataFile(`characters/${charId}/animations.json`, rawPayload)
		if (success) {
			setStatus(`Анимации сохранены в characters/${charId}/animations.json`)
		} else {
			setStatus(`Ошибка сохранения animations.json`, 'error')
		}
		return success
	}

	// Animation CRUD operations
	function createAnimation(template = {}) {
		const newId = template.id || `anim_${Date.now()}`
		const defaultAnim = {
			id: newId,
			name: template.name || 'Новая анимация',
			icon: template.icon || '✨',
			desc: template.desc || '',
			group: template.group || 'Кастомные',
			duration: Number(template.duration ?? 1.0),
			repeat: template.repeat || 'loop', // 'loop' | 'once' | 'pingpong' | 'count'
			repeatCount: Number(template.repeatCount ?? 2),
			timingMode: template.timingMode || 'timeline', // 'timeline' | 'script'
			tracks: template.tracks || [
				{
					target: selectedPartName.value || 'head',
					targetMode: 'single', // 'single' | 'hierarchy'
					keyframes: [
						{
							time: 0,
							transform: { rotate: 0, translateX: 0, translateY: 0, scale: 1 },
							sprite: null,
							opacity: 1,
							customCss: '',
							easing: 'ease-in-out'
						},
						{
							time: 0.5,
							transform: { rotate: 15, translateX: 0, translateY: -2, scale: 1 },
							sprite: null,
							opacity: 1,
							customCss: '',
							easing: 'ease-in-out'
						},
						{
							time: 1.0,
							transform: { rotate: 0, translateX: 0, translateY: 0, scale: 1 },
							sprite: null,
							opacity: 1,
							customCss: '',
							easing: 'ease-in-out'
						}
					]
				}
			],
			script: template.script || {
				enabled: false,
				code: `// Процедурный скрипт тика анимации:\n// time: время в сек, progress: 0..1, cycle: время цикла\nconst wave = sin(progress * 2 * PI);\nreturn {\n  head: { rot: wave * 10, x: wave * 2, y: 0 }\n};`
			}
		}

		customAnimations.value.push(defaultAnim)
		saveAnimationsJson()
		setStatus(`Создана анимация "${defaultAnim.name}"`)
		return defaultAnim
	}

	function updateAnimation(animId, updatedData) {
		const idx = customAnimations.value.findIndex((a) => a.id === animId)
		if (idx !== -1) {
			customAnimations.value[idx] = { ...customAnimations.value[idx], ...updatedData }
			saveAnimationsJson()
			setStatus(`Анимация "${customAnimations.value[idx].name}" обновлена`)
			return customAnimations.value[idx]
		}
		return null
	}

	function deleteAnimation(animId) {
		const idx = customAnimations.value.findIndex((a) => a.id === animId)
		if (idx !== -1) {
			const deleted = customAnimations.value.splice(idx, 1)[0]
			if (activeAnimation.value === animId) {
				stopAnimation()
			}
			saveAnimationsJson()
			setStatus(`Анимация "${deleted.name}" удалена`)
			return true
		}
		return false
	}

	function duplicateAnimation(animId) {
		const original = allAnimations.value.find((a) => a.id === animId)
		if (!original) return null
		const copy = JSON.parse(JSON.stringify(original))
		copy.id = `anim_${Date.now()}`
		copy.name = `${original.name} (Копия)`
		copy.group = original.group === 'Базовые' ? 'Кастомные' : (original.group || 'Кастомные')
		customAnimations.value.push(copy)
		saveAnimationsJson()
		setStatus(`Создана копия "${copy.name}"`)
		return copy
	}

	// Keyframe easing & interpolation helpers
	function applyEasing(t, easing = 'ease-in-out') {
		const clamped = Math.max(0, Math.min(1, t))
		switch (easing) {
			case 'linear':
				return clamped
			case 'ease-in':
				return clamped * clamped
			case 'ease-out':
				return clamped * (2 - clamped)
			case 'ease':
			case 'ease-in-out':
				return clamped < 0.5 ? 2 * clamped * clamped : -1 + (4 - 2 * clamped) * clamped
			case 'step':
			case 'steps':
				return 0
			default:
				return clamped
		}
	}

	function parseCustomCss(cssString) {
		if (!cssString || typeof cssString !== 'string') return null
		const styles = {}
		cssString.split(';').forEach((rule) => {
			const parts = rule.split(':').map((s) => s?.trim())
			if (parts[0] && parts[1]) {
				const camelProp = parts[0].replace(/-([a-z])/g, (_, c) => c.toUpperCase())
				styles[camelProp] = parts[1]
			}
		})
		return Object.keys(styles).length > 0 ? styles : null
	}

	function interpolateKeyframes(keyframes, localTime) {
		const sorted = [...keyframes].sort((a, b) => a.time - b.time)
		if (sorted.length === 1 || localTime <= sorted[0].time) {
			const kf = sorted[0]
			return {
				rotate: kf.transform?.rotate ?? kf.transform?.rot ?? 0,
				translateX: kf.transform?.translateX ?? kf.transform?.x ?? 0,
				translateY: kf.transform?.translateY ?? kf.transform?.y ?? 0,
				scale: kf.transform?.scale ?? 1,
				sprite: kf.sprite || null,
				customStyles: parseCustomCss(kf.customCss)
			}
		}

		const last = sorted[sorted.length - 1]
		if (localTime >= last.time) {
			return {
				rotate: last.transform?.rotate ?? last.transform?.rot ?? 0,
				translateX: last.transform?.translateX ?? last.transform?.x ?? 0,
				translateY: last.transform?.translateY ?? last.transform?.y ?? 0,
				scale: last.transform?.scale ?? 1,
				sprite: last.sprite || null,
				customStyles: parseCustomCss(last.customCss)
			}
		}

		let kfA = sorted[0]
		let kfB = sorted[1]
		for (let i = 0; i < sorted.length - 1; i++) {
			if (sorted[i].time <= localTime && localTime <= sorted[i + 1].time) {
				kfA = sorted[i]
				kfB = sorted[i + 1]
				break
			}
		}

		const span = kfB.time - kfA.time
		const tNorm = span > 0 ? (localTime - kfA.time) / span : 0
		const easedT = applyEasing(tNorm, kfA.easing || 'ease-in-out')

		function lerp(a, b, t) {
			return a + (b - a) * t
		}

		const rotA = kfA.transform?.rotate ?? kfA.transform?.rot ?? 0
		const rotB = kfB.transform?.rotate ?? kfB.transform?.rot ?? 0
		const xA = kfA.transform?.translateX ?? kfA.transform?.x ?? 0
		const xB = kfB.transform?.translateX ?? kfB.transform?.x ?? 0
		const yA = kfA.transform?.translateY ?? kfA.transform?.y ?? 0
		const yB = kfB.transform?.translateY ?? kfB.transform?.y ?? 0
		const sA = kfA.transform?.scale ?? 1
		const sB = kfB.transform?.scale ?? 1

		let activeSprite = null
		for (const kf of sorted) {
			if (kf.time <= localTime) {
				if (kf.sprite !== undefined) {
					activeSprite = kf.sprite
				}
			} else {
				break
			}
		}

		return {
			rotate: Number(lerp(rotA, rotB, easedT).toFixed(2)),
			translateX: Number(lerp(xA, xB, easedT).toFixed(2)),
			translateY: Number(lerp(yA, yB, easedT).toFixed(2)),
			scale: Number(lerp(sA, sB, easedT).toFixed(3)),
			sprite: activeSprite,
			customStyles: parseCustomCss(kfA.customCss)
		}
	}

	// Custom animation playback evaluator
	function evaluateCustomAnimation(anim, time) {
		const duration = anim.duration && anim.duration > 0 ? anim.duration : 1.0
		const repeat = anim.repeat || 'loop'
		let localTime = 0

		if (repeat === 'loop') {
			localTime = time % duration
		} else if (repeat === 'once') {
			if (time >= duration) {
				localTime = duration
				stopAnimation()
				return
			}
			localTime = time
		} else if (repeat === 'pingpong') {
			const cycle = time % (duration * 2)
			localTime = cycle < duration ? cycle : (duration * 2 - cycle)
		} else if (repeat === 'count') {
			const maxLoops = anim.repeatCount || 2
			if (time >= duration * maxLoops) {
				localTime = duration
				stopAnimation()
				return
			}
			localTime = time % duration
		} else {
			localTime = time % duration
		}

		const progress = duration > 0 ? localTime / duration : 0

		// Procedural Script Mode
		if (
			anim.mode === 'script' ||
			anim.timingMode === 'script' ||
			anim.script?.enabled ||
			(anim.script?.code && (!anim.tracks || anim.tracks.length === 0))
		) {
			const code = anim.script?.code || ''
			if (code.trim()) {
				try {
					// Note: new Function() may be blocked by CSP in Electron production builds.
					// If blocked, we skip the script frame and show a one-time warning.
					const fn = new Function( // eslint-disable-line no-new-func
						'time', 'progress', 'cycle', 'duration',
						'sin', 'cos', 'tan', 'PI', 'abs', 'min', 'max', 'round', 'floor', 'random',
						'parts', 'getDescendants',
						code
					)
					const result = fn(
						time,
						progress,
						localTime,
						duration,
						Math.sin,
						Math.cos,
						Math.tan,
						Math.PI,
						Math.abs,
						Math.min,
						Math.max,
						Math.round,
						Math.floor,
						Math.random,
						bodyParts,
						getDescendants
					)
					if (result && typeof result === 'object') {
						for (const [part, vals] of Object.entries(result)) {
							if (!vals) continue
							if (vals.rot !== undefined) partRotations[part] = Number(vals.rot)
							if (vals.rotate !== undefined) partRotations[part] = Number(vals.rotate)
							if (vals.x !== undefined || vals.y !== undefined) {
								partTranslations[part] = {
									x: Number(vals.x || 0),
									y: Number(vals.y || 0)
								}
							}
							if (vals.scale !== undefined) partScales[part] = Number(vals.scale)
							if (vals.sprite !== undefined) {
								if (vals.sprite) animatedSprites[part] = vals.sprite
								else delete animatedSprites[part]
							}
							if (vals.styles) partCustomStyles[part] = vals.styles
						}
					}
				} catch (err) {
					// EvalError = CSP blocked new Function() — only warn once to avoid console spam
					if (err instanceof EvalError) {
						if (!evaluateCustomAnimation._cspWarned) {
							evaluateCustomAnimation._cspWarned = true
							console.warn(
								'[AnimationScript] Процедурные скрипты заблокированы политикой CSP (Content Security Policy).\n' +
								'В production-сборке Electron new Function() недоступен.\n' +
								'Используйте режим «Ключевые кадры (Таймлайн)» вместо процедурного скрипта.',
								err
							)
						}
					} else {
						console.warn('[AnimationScript Error]:', err)
					}
				}
			}
			return
		}

		// Timeline Keyframe Mode

		if (!anim.tracks || !Array.isArray(anim.tracks)) return

		for (const track of anim.tracks) {
			if (!track.target) continue
			const keyframes = track.keyframes || []
			if (keyframes.length === 0) continue

			const targetParts = track.targetMode === 'hierarchy'
				? [track.target, ...getDescendants(track.target)]
				: [track.target]

			const state = interpolateKeyframes(keyframes, localTime)

			for (const part of targetParts) {
				if (state.rotate !== undefined) {
					partRotations[part] = state.rotate
				}
				if (state.translateX !== undefined || state.translateY !== undefined) {
					partTranslations[part] = {
						x: state.translateX || 0,
						y: state.translateY || 0
					}
				}
				if (state.scale !== undefined) {
					partScales[part] = state.scale
				}
				if (state.sprite !== undefined) {
					if (state.sprite) {
						animatedSprites[part] = state.sprite
					} else {
						delete animatedSprites[part]
					}
				}
				if (state.customStyles) {
					partCustomStyles[part] = state.customStyles
				}
			}
		}
	}

	// Animation Sequencer
	function playAnimation(animIdOrObj) {
		stopAnimation()
		const animId = typeof animIdOrObj === 'object' && animIdOrObj !== null ? animIdOrObj.id : animIdOrObj
		activeAnimation.value = animId
		isPlaying.value = true
		animStartTime = performance.now()

		function loop(timestamp) {
			if (!isPlaying.value) return
			const elapsed = ((timestamp - animStartTime) / 1000) * animationSpeed.value
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
		// Reset temporary rotations, translations, scales, styles, and sprite overrides
		for (const k in partRotations) {
			partRotations[k] = 0
		}
		for (const k in partTranslations) {
			partTranslations[k] = { x: 0, y: 0 }
		}
		for (const k in partScales) {
			partScales[k] = 1
		}
		for (const k in partCustomStyles) {
			delete partCustomStyles[k]
		}
		for (const k in animatedSprites) {
			delete animatedSprites[k]
		}
	}

	function stepAnimation(animId, time) {
		// Check if custom animation exists first
		const custom = customAnimations.value.find((a) => a.id === animId)
		if (custom) {
			evaluateCustomAnimation(custom, time)
			return
		}

		// Check if builtin animation has tracks (new keyframe format) — use unified evaluator
		const builtin = BUILTIN_ANIMATIONS.find((a) => a.id === animId)
		if (builtin && Array.isArray(builtin.tracks) && builtin.tracks.length > 0) {
			evaluateCustomAnimation(builtin, time)
			return
		}

		// Legacy switch/case fallback for builtins without tracks (VN runtime backward compat)
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
				// Replicate intro cough animation (0.5s double-cough burst matching CSS coughHead/coughNeck)
				const cycleDuration = 1.3
				const localTime = time % cycleDuration
				let impulse = 0
				let neckTilt = 0

				if (localTime < 0.5) {
					// Two distinct cough impulses: 0 to 0.25s (peak at 0.125s), 0.25s to 0.5s (peak at 0.375s)
					if (localTime < 0.25) {
						impulse = Math.sin((localTime / 0.25) * Math.PI)
					} else {
						impulse = Math.sin(((localTime - 0.25) / 0.25) * Math.PI)
					}
					// Overall neck/head forward tilt during the coughing burst (peaks at -8deg)
					neckTilt = Math.sin((localTime / 0.5) * Math.PI) * -8
				}

				// Head displacement: translate(-2.5%, 3%) matching @keyframes coughHead
				if (bodyParts['head']) {
					partTranslations['head'] = {
						x: Number((-2.5 * impulse).toFixed(2)),
						y: Number((3.0 * impulse).toFixed(2))
					}
				}

				// Neck and head rotation:
				if (bodyParts['neck']) {
					partRotations['neck'] = Number(neckTilt.toFixed(2))
					if (bodyParts['head']) {
						partRotations['head'] = Number((-3 * impulse).toFixed(2))
					}
				} else if (bodyParts['head']) {
					// Fallback when character has no separate neck part
					partRotations['head'] = Number((neckTilt - 3 * impulse).toFixed(2))
				}

				// Body does NOT shake!
				if (bodyParts['body']) {
					partRotations['body'] = 0
					partTranslations['body'] = { x: 0, y: 0 }
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
	function exportAnimationToJson(animIdOrPart = selectedPartName.value) {
		const anim = allAnimations.value.find((a) => a.id === animIdOrPart)
		if (anim) {
			const step = {
				type: 'animate',
				character: selectedCharacterId.value,
				animation: anim.id,
				duration: anim.duration || 1.0
			}
			const jsonString = JSON.stringify(step, null, 2)
			if (navigator.clipboard?.writeText) {
				navigator.clipboard.writeText(jsonString)
				setStatus(`Шаг сценария для анимации "${anim.name}" скопирован в буфер обмена!`)
			}
			return jsonString
		}

		// Fallback to single part export
		const partName = animIdOrPart || selectedPartName.value
		const rot = partRotations[partName] || 0
		const trans = partTranslations[partName] || { x: 0, y: 0 }
		const scale = partScales[partName] ?? 1
		const transformParts = []
		if (rot) {
			transformParts.push(`rotate(${Math.round(rot)}deg)`)
		}
		if (trans.x || trans.y) {
			transformParts.push(`translate(${trans.x}%, ${trans.y}%)`)
		}
		if (scale !== undefined && scale !== 1) {
			transformParts.push(`scale(${scale})`)
		}
		const step = {
			type: 'part-animate',
			character: selectedCharacterId.value,
			part: partName,
			styles: {
				transform: transformParts.length > 0 ? transformParts.join(' ') : 'none',
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
		// Rotations, Translations, Scales & Posing
		partRotations,
		partTranslations,
		partScales,
		partCustomStyles,
		animatedSprites,
		partPivots,
		// Animations
		BUILTIN_ANIMATIONS,
		customAnimations,
		allAnimations,
		animationGroups,
		selectedAnimationGroup,
		filteredAnimations,
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
		stepAnimation,
		evaluateCustomAnimation,
		interpolateKeyframes,
		getDescendants,
		loadAnimationsJson,
		saveAnimationsJson,
		createAnimation,
		updateAnimation,
		deleteAnimation,
		duplicateAnimation,
		exportAnimationToJson,
		saveBodyJson,
		saveValuesJson,
		setStatus
	}
}
