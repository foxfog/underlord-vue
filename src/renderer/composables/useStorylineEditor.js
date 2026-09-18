import { ref, computed } from 'vue'

export function useStorylineEditor() {
	// Locale
	const activeLocale = ref('ru')
	const availableLocales = ref([
		{ code: 'ru', label: 'Русский', flag: '🇷🇺' },
		{ code: 'en', label: 'English', flag: '🇬🇧' }
	])

	// File Tree state
	const fileTree = ref([])
	const expandedFolders = ref(new Set())
	const selectedFilePath = ref('')
	const isLoadingTree = ref(false)
	const isLoadingFile = ref(false)
	const isSaving = ref(false)
	const isDirty = ref(false)
	const searchQuery = ref('')
	const statusMessage = ref(null)
	let statusTimeout = null

	// Story State
	const currentStory = ref({
		id: '',
		steps: []
	})
	const activeStepIndex = ref(0)
	const stepEditMode = ref('visual') // 'visual' | 'json'
	const viewMode = ref('timeline') // 'timeline' | 'graph' | 'json'
	const navigationHistory = ref([])
	const isRawFileMode = ref(false)
	const rawFileContent = ref('')

	// Cross-file reference tracking and scenario cache
	const storyFileCache = new Map()
	const inboundReferences = ref([])

	const canNavigateBack = computed(() => navigationHistory.value.length > 0)
	const previousScenarioPath = computed(() => {
		if (navigationHistory.value.length === 0) return null
		return navigationHistory.value[navigationHistory.value.length - 1]
	})

	// Registries and Suggestions
	const availableCharacters = ref([
		{ id: 'mc', name: 'Главный герой (Анон)', avatar: 'images/sprites/characters/mc/char.png' },
		{ id: 'momonga', name: 'Момонга (Аинз Оал Гоун)', avatar: 'images/sprites/characters/momonga/char.png' },
		{ id: 'albedo', name: 'Альбедо', avatar: 'images/sprites/characters/albedo/char.png' },
		{ id: 'enri', name: 'Энри Эммот', avatar: 'images/sprites/characters/enri/char.png' },
		{ id: 'carne-chief', name: 'Староста Карна', avatar: 'images/sprites/characters/carne-chief/char.png' }
	])

	const availableScenes = ref([
		'city_street',
		'mc_factory',
		'cybercity_mchome',
		'carne_village_square',
		'carne_chief_house',
		'yggdrasil_throne',
		'black_screen'
	])

	const availableAudioStreams = ref([
		'bgm',
		'sfx',
		'voice',
		'ambient',
		'swt',
		'factory',
		'back'
	])

	function setStatus(text, type = 'info', duration = 3500) {
		if (statusTimeout) clearTimeout(statusTimeout)
		statusMessage.value = { text, type }
		if (duration > 0) {
			statusTimeout = setTimeout(() => {
				statusMessage.value = null
			}, duration)
		}
	}

	// Active step computed
	const activeStep = computed(() => {
		if (!currentStory.value?.steps || activeStepIndex.value < 0) return null
		return currentStory.value.steps[activeStepIndex.value] || null
	})

	const totalStepsCount = computed(() => {
		return currentStory.value?.steps?.length || 0
	})

	// Toggle folder open/closed
	function toggleFolder(folderPath) {
		if (expandedFolders.value.has(folderPath)) {
			expandedFolders.value.delete(folderPath)
		} else {
			expandedFolders.value.add(folderPath)
		}
	}

	function isFolderExpanded(folderPath) {
		return expandedFolders.value.has(folderPath)
	}

	// Load file tree via Electron IPC or fallback
	async function loadFileTree() {
		isLoadingTree.value = true
		try {
			const relativeDir = `story/${activeLocale.value}`
			if (typeof window !== 'undefined' && window.electronAPI?.dataEditor?.listTree) {
				const res = await window.electronAPI.dataEditor.listTree(relativeDir)
				if (res?.success && Array.isArray(res.tree)) {
					fileTree.value = res.tree
					// Auto expand root subfolders
					res.tree.forEach((item) => {
						if (item.isDirectory) expandedFolders.value.add(item.path)
					})
					return
				}
			}

			// Fallback if listTree is not available or in web/testing mode
			fileTree.value = createFallbackTree(activeLocale.value)
		} catch (err) {
			console.error('Ошибка при загрузке дерева файлов:', err)
			setStatus(`Ошибка чтения файлов: ${err.message}`, 'error')
		} finally {
			isLoadingTree.value = false
		}
	}

	function createFallbackTree(locale) {
		return [
			{
				name: 'intro.json',
				isDirectory: false,
				path: `story/${locale}/intro.json`
			},
			{
				name: 'start.json',
				isDirectory: false,
				path: `story/${locale}/start.json`
			},
			{
				name: 'nameinput.json',
				isDirectory: false,
				path: `story/${locale}/nameinput.json`
			},
			{
				name: 'cyber',
				isDirectory: true,
				path: `story/${locale}/cyber`,
				children: [
					{
						name: 'mchome.json',
						isDirectory: false,
						path: `story/${locale}/cyber/mchome.json`
					},
					{
						name: 'factory',
						isDirectory: true,
						path: `story/${locale}/cyber/factory`,
						children: [
							{
								name: 'factory_main.json',
								isDirectory: false,
								path: `story/${locale}/cyber/factory/factory_main.json`
							},
							{
								name: 'work_on_machine.json',
								isDirectory: false,
								path: `story/${locale}/cyber/factory/work_on_machine.json`
							},
							{
								name: 'take_break.json',
								isDirectory: false,
								path: `story/${locale}/cyber/factory/take_break.json`
							},
							{
								name: 'go_to_cafeteria.json',
								isDirectory: false,
								path: `story/${locale}/cyber/factory/go_to_cafeteria.json`
							}
						]
					}
				]
			},
			{
				name: 'carne',
				isDirectory: true,
				path: `story/${locale}/carne`,
				children: [
					{
						name: 'bandits.json',
						isDirectory: false,
						path: `story/${locale}/carne/bandits.json`
					}
				]
			},
			{
				name: 'carne-chief',
				isDirectory: true,
				path: `story/${locale}/carne-chief`,
				children: [
					{
						name: 'menu.json',
						isDirectory: false,
						path: `story/${locale}/carne-chief/menu.json`
					},
					{
						name: 'talk.json',
						isDirectory: false,
						path: `story/${locale}/carne-chief/talk.json`
					}
				]
			},
			{
				name: 'death',
				isDirectory: true,
				path: `story/${locale}/death`,
				children: [
					{
						name: 'suffocation.json',
						isDirectory: false,
						path: `story/${locale}/death/suffocation.json`
					}
				]
			},
			{
				name: 'macros',
				isDirectory: true,
				path: `story/${locale}/macros`,
				children: [
					{
						name: 'cough.json',
						isDirectory: false,
						path: `story/${locale}/macros/cough.json`
					}
				]
			}
		]
	}

	// Normalization helpers
	function normalizeStoryPath(filePath) {
		if (!filePath || typeof filePath !== 'string') return ''
		let clean = filePath.trim().replace(/^\/+|\/+$/g, '')
		clean = clean.replace(/\.json$/, '')
		clean = clean.replace(/^story\/[^/]+\//, '')
		return `story/${activeLocale.value}/${clean}.json`
	}

	function getCleanScenarioId(filePath) {
		if (!filePath || typeof filePath !== 'string') return ''
		let clean = filePath.trim().replace(/^\/+|\/+$/g, '')
		clean = clean.replace(/\.json$/, '')
		clean = clean.replace(/^story\/[^/]+\//, '')
		return clean
	}

	function collectFilesFromTree(nodes, out = []) {
		if (!Array.isArray(nodes)) return out
		for (const node of nodes) {
			if (node.isDirectory && Array.isArray(node.children)) {
				collectFilesFromTree(node.children, out)
			} else if (!node.isDirectory && node.path && node.path.endsWith('.json')) {
				out.push(node.path)
			}
		}
		return out
	}

	// Read any story file from cache or disk/fetch
	async function readStoryFile(filePath) {
		const norm = normalizeStoryPath(filePath)
		if (!norm) return null
		if (storyFileCache.has(norm)) {
			return storyFileCache.get(norm)
		}

		try {
			let data = null
			if (typeof window !== 'undefined' && window.electronAPI?.dataEditor?.readFile) {
				const res = await window.electronAPI.dataEditor.readFile(norm)
				if (res?.success && res.data) {
					data = res.data
				}
			} else {
				const base = typeof window !== 'undefined' && window.__APP_BASE__ ? window.__APP_BASE__ : ''
				const fullUrl = `${base}data/${norm}`
				const res = await fetch(fullUrl)
				if (res.ok) {
					data = await res.json()
				}
			}

			if (data && typeof data === 'object') {
				storyFileCache.set(norm, data)
				return data
			}
		} catch (err) {
			// Suppress error if file is missing or unparseable
		}
		return null
	}

	// Check if a target scenario returns back to caller (continue or explicit return)
	function checkScenarioReturn(target, currentStoryId) {
		let data = null
		if (typeof target === 'string') {
			const norm = normalizeStoryPath(target)
			data = storyFileCache.get(norm)
		} else if (target && typeof target === 'object') {
			data = target
		}

		if (!data || !Array.isArray(data.steps) || data.steps.length === 0) {
			return { returns: false }
		}

		const steps = data.steps
		const cleanCurrent = getCleanScenarioId(currentStoryId)

		// 1. Check if any step explicitly continues or returns to cleanCurrent
		for (let i = 0; i < steps.length; i++) {
			const step = steps[i]
			if (step.type === 'continue') {
				return { returns: true, type: 'continue', stepIndex: i, label: '↩ continue' }
			}
			if (step.type === 'goto' && step.target) {
				const targetClean = getCleanScenarioId(step.target)
				if (cleanCurrent && targetClean === cleanCurrent) {
					return {
						returns: true,
						type: 'explicit',
						target: step.target,
						stepIndex: i,
						label: `↩ ${cleanCurrent}`
					}
				}
			}
		}

		// 2. Fall-through return if last step is not terminal ('end', 'hold', or unreturned 'goto')
		const lastStep = steps[steps.length - 1]
		if (lastStep && lastStep.type !== 'end' && lastStep.type !== 'hold' && lastStep.type !== 'goto') {
			return { returns: true, type: 'implicit', stepIndex: steps.length - 1, label: '↩ continue' }
		}

		return { returns: false }
	}

	// Scan other scenario files for jumps/choices pointing to target scenario
	async function scanInboundReferences(targetPath) {
		if (!targetPath) {
			inboundReferences.value = []
			return []
		}

		const targetId = getCleanScenarioId(targetPath)
		const targetNorm = normalizeStoryPath(targetPath)

		if (fileTree.value.length === 0) {
			await loadFileTree()
		}

		const allFiles = collectFilesFromTree(fileTree.value)
		const results = []

		for (const fPath of allFiles) {
			const fNorm = normalizeStoryPath(fPath)
			if (fNorm === targetNorm) continue

			let fileData = storyFileCache.get(fNorm)
			if (!fileData) {
				fileData = await readStoryFile(fPath)
			}

			if (!fileData || !Array.isArray(fileData.steps)) continue

			fileData.steps.forEach((step, stepIdx) => {
				if (step.type === 'goto' && step.target) {
					const candId = getCleanScenarioId(step.target)
					if (candId === targetId) {
						results.push({
							sourceFile: fNorm,
							sourceFileName: getFileName(fNorm),
							sourceStoryId: fileData.id || getCleanScenarioId(fNorm),
							stepIndex: stepIdx,
							stepType: 'goto',
							target: step.target,
							condition: step.if || step.condition || null,
							step
						})
					}
				} else if (step.type === 'choice') {
					const options = step.options || step.choices || []
					options.forEach((opt, optIdx) => {
						let optTarget = opt.goto || opt.target
						if (!optTarget && Array.isArray(opt.actions)) {
							const g = opt.actions.find((a) => a.type === 'goto')
							if (g) optTarget = g.target || g.id
						}
						if (optTarget && getCleanScenarioId(optTarget) === targetId) {
							results.push({
								sourceFile: fNorm,
								sourceFileName: getFileName(fNorm),
								sourceStoryId: fileData.id || getCleanScenarioId(fNorm),
								stepIndex: stepIdx,
								stepType: 'choice',
								optionIndex: optIdx,
								optionText: opt.text || `Вариант ${optIdx + 1}`,
								target: optTarget,
								condition: opt.if || opt.condition || step.if || step.condition || null,
								step
							})
						}
					})
				}
			})
		}

		inboundReferences.value = results
		return results
	}

	// Load story JSON file
	async function loadStoryFile(filePath) {
		isLoadingFile.value = true
		try {
			// Normalize relative path
			let relPath = filePath
			if (relPath.startsWith(`story/${activeLocale.value}/`)) {
				// Keep full relative path under data/
			} else if (!relPath.startsWith('story/')) {
				relPath = `story/${activeLocale.value}/${relPath}`
			}

			let data = null
			if (typeof window !== 'undefined' && window.electronAPI?.dataEditor?.readFile) {
				const res = await window.electronAPI.dataEditor.readFile(relPath)
				if (res.success) {
					data = res.data
				} else {
					throw new Error(res.error || 'Не удалось прочитать файл')
				}
			} else {
				// Web fallback
				const base = typeof window !== 'undefined' && window.__APP_BASE__ ? window.__APP_BASE__ : ''
				const fullUrl = `${base}data/${relPath}`
				const res = await fetch(fullUrl)
				if (res.ok) {
					data = await res.json()
				} else {
					// Minimal fallback mock
					data = {
						id: filePath.replace(/\.json$/, '').replace(/^story\/[^/]+\//, ''),
						steps: [
							{ type: 'dialogue', character: 'mc', text: 'Загружен тестовый сценарий' }
						]
					}
				}
			}

			// Validate and normalize structure
			if (!data || typeof data !== 'object') {
				throw new Error('Некорректный формат JSON')
			}

			if (!Array.isArray(data.steps)) {
				data.steps = []
			}

			currentStory.value = JSON.parse(JSON.stringify(data))
			storyFileCache.set(relPath, currentStory.value)
			rawFileContent.value = JSON.stringify(currentStory.value, null, 2)
			selectedFilePath.value = filePath
			activeStepIndex.value = 0
			isDirty.value = false
			isRawFileMode.value = false
			setStatus(`Файл ${getFileName(filePath)} успешно загружен`, 'success', 2000)

			// Scan inbound links and prefetch external jump targets
			await scanInboundReferences(relPath)
			if (Array.isArray(currentStory.value.steps)) {
				for (const s of currentStory.value.steps) {
					if (s.type === 'goto' && s.target) {
						await readStoryFile(s.target)
					} else if (s.type === 'choice' && Array.isArray(s.options)) {
						for (const opt of s.options) {
							let t = opt.goto || opt.target
							if (!t && Array.isArray(opt.actions)) {
								const g = opt.actions.find((a) => a.type === 'goto')
								if (g) t = g.target
							}
							if (t) await readStoryFile(t)
						}
					}
				}
			}
		} catch (err) {
			console.error('Ошибка загрузки сценария:', err)
			setStatus(`Ошибка: ${err.message}`, 'error')
		} finally {
			isLoadingFile.value = false
		}
	}

	// Save story JSON file
	async function saveStoryFile() {
		if (!selectedFilePath.value) {
			setStatus('Нет выбранного файла для сохранения', 'warning')
			return
		}

		isSaving.value = true
		try {
			let payloadToSave = null

			if (isRawFileMode.value) {
				try {
					payloadToSave = JSON.parse(rawFileContent.value)
					currentStory.value = JSON.parse(JSON.stringify(payloadToSave))
				} catch (parseErr) {
					throw new Error(`Ошибка в синтаксисе JSON: ${parseErr.message}`)
				}
			} else {
				payloadToSave = JSON.parse(JSON.stringify(currentStory.value))
			}

			let relPath = selectedFilePath.value
			if (!relPath.startsWith('story/')) {
				relPath = `story/${activeLocale.value}/${relPath}`
			}

			if (typeof window !== 'undefined' && window.electronAPI?.dataEditor?.writeFile) {
				const res = await window.electronAPI.dataEditor.writeFile(relPath, payloadToSave)
				if (!res.success) throw new Error(res.error || 'Ошибка записи на диск')
			} else {
				console.log('[useStorylineEditor] Сохранение без Electron IPC:', relPath, payloadToSave)
			}

			rawFileContent.value = JSON.stringify(currentStory.value, null, 2)
			isDirty.value = false
			setStatus(`Файл ${getFileName(selectedFilePath.value)} сохранён`, 'success', 2500)
		} catch (err) {
			console.error('Ошибка сохранения:', err)
			setStatus(`Ошибка: ${err.message}`, 'error')
		} finally {
			isSaving.value = false
		}
	}

	// Create new story file
	async function createStoryFile(folderRelPath, fileName) {
		try {
			let cleanName = fileName.trim()
			if (!cleanName.endsWith('.json')) cleanName += '.json'

			let targetFolder = folderRelPath || `story/${activeLocale.value}`
			const targetPath = `${targetFolder}/${cleanName}`.replace(/\/+/g, '/')

			// Initial story template
			const derivedId = cleanName.replace(/\.json$/, '')
			const initialData = {
				id: derivedId,
				steps: [
					{
						type: 'scene',
						id: 'city_street'
					},
					{
						type: 'dialogue',
						character: 'mc',
						text: 'Новый сценарий начинается здесь...'
					}
				]
			}

			if (typeof window !== 'undefined' && window.electronAPI?.dataEditor?.writeFile) {
				const res = await window.electronAPI.dataEditor.writeFile(targetPath, initialData)
				if (!res.success) throw new Error(res.error || 'Не удалось создать файл')
			}

			await loadFileTree()
			await loadStoryFile(targetPath)
			setStatus(`Создан файл: ${cleanName}`, 'success')
			return targetPath
		} catch (err) {
			console.error('Ошибка создания файла:', err)
			setStatus(`Ошибка: ${err.message}`, 'error')
			throw err
		}
	}

	// Create new subfolder
	async function createStoryFolder(parentPath, folderName) {
		try {
			const cleanFolderName = folderName.trim().replace(/[^a-zA-Z0-9_-]/g, '_')
			if (!cleanFolderName) throw new Error('Некорректное имя папки')

			const targetParent = parentPath || `story/${activeLocale.value}`
			const newFolderPath = `${targetParent}/${cleanFolderName}`.replace(/\/+/g, '/')

			if (typeof window !== 'undefined' && window.electronAPI?.dataEditor?.createDir) {
				const res = await window.electronAPI.dataEditor.createDir(newFolderPath)
				if (!res.success) throw new Error(res.error || 'Не удалось создать папку')
			}

			expandedFolders.value.add(targetParent)
			expandedFolders.value.add(newFolderPath)
			await loadFileTree()
			setStatus(`Папка создана: ${cleanFolderName}`, 'success')
			return newFolderPath
		} catch (err) {
			console.error('Ошибка создания папки:', err)
			setStatus(`Ошибка: ${err.message}`, 'error')
			throw err
		}
	}

	// Delete story file or folder
	async function deleteStoryItem(itemPath, isDirectory = false) {
		try {
			if (isDirectory) {
				if (typeof window !== 'undefined' && window.electronAPI?.dataEditor?.deleteDir) {
					const res = await window.electronAPI.dataEditor.deleteDir(itemPath)
					if (!res.success) throw new Error(res.error || 'Ошибка удаления папки')
				}
				expandedFolders.value.delete(itemPath)
			} else {
				if (typeof window !== 'undefined' && window.electronAPI?.dataEditor?.deleteFile) {
					const res = await window.electronAPI.dataEditor.deleteFile(itemPath)
					if (!res.success) throw new Error(res.error || 'Ошибка удаления файла')
				}
				if (selectedFilePath.value === itemPath) {
					selectedFilePath.value = ''
					currentStory.value = { id: '', steps: [] }
					rawFileContent.value = ''
					isDirty.value = false
				}
			}

			await loadFileTree()
			setStatus(`Удалено: ${getFileName(itemPath)}`, 'info')
		} catch (err) {
			console.error('Ошибка удаления:', err)
			setStatus(`Ошибка: ${err.message}`, 'error')
			throw err
		}
	}

	// Step manipulation
	function addStep(type = 'dialogue', targetIndex = null) {
		if (!currentStory.value) return

		let newStep = {}
		switch (type) {
			case 'dialogue':
				newStep = { type: 'dialogue', character: 'mc', text: '' }
				break
			case 'scene':
				newStep = { type: 'scene', id: 'city_street' }
				break
			case 'show':
				newStep = {
					type: 'show',
					character: 'mc',
					orientation: 'left',
					position: { l: 20, r: 'auto' }
				}
				break
			case 'hide':
				newStep = { type: 'hide', character: 'mc' }
				break
			case 'clear-characters':
			case 'hide-all':
				newStep = { type: 'hide-all' }
				break
			case 'music':
				newStep = {
					type: 'music',
					file: 'audio/music/intro.mp3',
					loop: true,
					stream: 'bgm'
				}
				break
			case 'sound':
				newStep = {
					type: 'sound',
					file: 'audio/sound/click.mp3',
					loop: false,
					stream: 'sfx'
				}
				break
			case 'stop-stream':
				newStep = { type: 'stop-stream', stream: 'bgm' }
				break
			case 'choice':
				newStep = {
					type: 'choice',
					options: [
						{ text: 'Вариант 1', actions: [{ type: 'goto', target: '' }] },
						{ text: 'Вариант 2', actions: [{ type: 'goto', target: '' }] }
					]
				}
				break
			case 'goto':
				newStep = { type: 'goto', target: '' }
				break
			case 'variable':
				newStep = { variable: 'global.flag = true' }
				break
			case 'titles':
				newStep = {
					type: 'titles',
					text: '<p class="t-32">Заголовок главы</p>',
					duration: 5,
					'auto-end': true
				}
				break
			case 'fade':
				newStep = { type: 'fade', duration: 1 }
				break
			case 'ui':
				newStep = { type: 'ui', target: ['topbar'], action: 'show' }
				break
			case 'quest':
				newStep = {
					type: 'quest',
					action: 'start',
					id: 'quest_id',
					title: 'Название квеста',
					description: 'Описание задания'
				}
				break
			case 'notification':
				newStep = {
					type: 'notification',
					text: 'Уведомление',
					notificationType: 'info',
					duration: 3000
				}
				break
			case 'discover-location':
				newStep = {
					type: 'discover-location',
					map: 'cybercity',
					locations: ['factory']
				}
				break
			case 'hold':
				newStep = { type: 'hold' }
				break
			case 'continue':
				newStep = { type: 'continue' }
				break
			case 'end':
				newStep = { type: 'end' }
				break
			case 'raw':
			default:
				newStep = { type: type === 'raw' ? 'custom' : type }
				break
		}

		const insertAt =
			targetIndex !== null
				? targetIndex
				: activeStepIndex.value >= 0 && activeStepIndex.value < currentStory.value.steps.length
					? activeStepIndex.value + 1
					: currentStory.value.steps.length

		currentStory.value.steps.splice(insertAt, 0, newStep)
		activeStepIndex.value = insertAt
		isDirty.value = true
		rawFileContent.value = JSON.stringify(currentStory.value, null, 2)
	}

	function duplicateStep(index) {
		if (!currentStory.value?.steps || index < 0 || index >= currentStory.value.steps.length) return
		const copy = JSON.parse(JSON.stringify(currentStory.value.steps[index]))
		currentStory.value.steps.splice(index + 1, 0, copy)
		activeStepIndex.value = index + 1
		isDirty.value = true
		rawFileContent.value = JSON.stringify(currentStory.value, null, 2)
	}

	function removeStep(index) {
		if (!currentStory.value?.steps || index < 0 || index >= currentStory.value.steps.length) return
		currentStory.value.steps.splice(index, 1)
		if (activeStepIndex.value >= currentStory.value.steps.length) {
			activeStepIndex.value = Math.max(0, currentStory.value.steps.length - 1)
		}
		isDirty.value = true
		rawFileContent.value = JSON.stringify(currentStory.value, null, 2)
	}

	function moveStep(fromIndex, toIndex) {
		if (
			!currentStory.value?.steps ||
			fromIndex < 0 ||
			fromIndex >= currentStory.value.steps.length ||
			toIndex < 0 ||
			toIndex >= currentStory.value.steps.length
		)
			return

		const item = currentStory.value.steps.splice(fromIndex, 1)[0]
		currentStory.value.steps.splice(toIndex, 0, item)
		activeStepIndex.value = toIndex
		isDirty.value = true
		rawFileContent.value = JSON.stringify(currentStory.value, null, 2)
	}

	function updateActiveStep(stepData) {
		if (!currentStory.value?.steps || activeStepIndex.value < 0) return
		currentStory.value.steps[activeStepIndex.value] = JSON.parse(JSON.stringify(stepData))
		isDirty.value = true
		rawFileContent.value = JSON.stringify(currentStory.value, null, 2)
	}

	function updateStepType(newType) {
		if (!activeStep.value) return
		const step = activeStep.value
		// Preserve common fields if possible
		const ifCondition = step.if || step.condition

		let updated = { type: newType }
		if (ifCondition) updated.if = ifCondition

		if (newType === 'dialogue') {
			updated.character = 'mc'
			updated.text = step.text || ''
		} else if (newType === 'scene') {
			updated.id = 'city_street'
		} else if (newType === 'music' || newType === 'sound') {
			updated.file = 'audio/music/intro.mp3'
			updated.loop = newType === 'music'
			updated.stream = newType === 'music' ? 'bgm' : 'sfx'
		} else if (newType === 'choice') {
			updated.options = [{ text: 'Вариант', actions: [{ type: 'goto', target: '' }] }]
		} else if (newType === 'goto') {
			updated.target = ''
		} else if (newType === 'variable') {
			delete updated.type
			updated.variable = 'global.flag = true'
		}

		currentStory.value.steps[activeStepIndex.value] = updated
		isDirty.value = true
		rawFileContent.value = JSON.stringify(currentStory.value, null, 2)
	}

	// Change locale
	async function switchLocale(newLocale) {
		if (activeLocale.value === newLocale) return
		activeLocale.value = newLocale
		selectedFilePath.value = ''
		currentStory.value = { id: '', steps: [] }
		rawFileContent.value = ''
		isDirty.value = false
		await loadFileTree()
	}

	// Resolve scenario target path (e.g. 'macros/cough' or 'nameinput' -> 'story/ru/macros/cough.json')
	function resolveScenarioPath(target) {
		if (!target || typeof target !== 'string') return ''
		let clean = target.trim().replace(/^\/+|\/+$/g, '')
		clean = clean.replace(/^story\/[^/]+\//, '')
		clean = clean.replace(/\.json$/, '')
		return `story/${activeLocale.value}/${clean}.json`
	}

	// Jump directly from one scenario to another (e.g. from intro to macros/cough)
	async function jumpToScenario(target, targetStepIndex = 0) {
		const resolved = resolveScenarioPath(target)
		if (!resolved) return
		if (selectedFilePath.value && selectedFilePath.value !== resolved) {
			navigationHistory.value.push(selectedFilePath.value)
		}
		await loadStoryFile(resolved)
		if (typeof targetStepIndex === 'number' && targetStepIndex >= 0) {
			activeStepIndex.value = targetStepIndex
		}
	}

	// Navigate back to previously viewed scenario
	async function navigateBack() {
		if (navigationHistory.value.length === 0) return
		const prev = navigationHistory.value.pop()
		if (prev) {
			await loadStoryFile(prev)
		}
	}

	// Build node topology graph for visual node-based editor
	function buildStoryGraph(steps = []) {
		if (!Array.isArray(steps)) return { nodes: [], links: [], outboundNodes: [] }

		const nodes = []
		const links = []
		const outboundNodes = []
		const outboundStackCount = new Map()

		// Build label/id index map
		const idToIndexMap = new Map()
		steps.forEach((step, idx) => {
			if (step.id) idToIndexMap.set(String(step.id), idx)
			if (step.label) idToIndexMap.set(String(step.label), idx)
		})

		const defaultNodeWidth = 16.5
		const nodeHeight = 7.5
		const colGap = 7.0

		// Pre-compute node widths and horizontal positions (with adaptive width for choices)
		const stepLayouts = []
		let runningX = 0
		steps.forEach((step) => {
			let w = defaultNodeWidth
			if (step.type === 'choice') {
				const options = step.options || step.choices || []
				const maxChoiceTextLen = options.reduce((max, opt) => Math.max(max, (opt.text || '').length), 0)
				if (maxChoiceTextLen > 25) {
					w = 19.5
				} else if (maxChoiceTextLen > 15) {
					w = 18.0
				}
			}
			stepLayouts.push({ x: runningX, width: w, height: nodeHeight })
			runningX += w + colGap
		})

		function getChoiceOutboundPos(stepIdx, optIdx, continuationOptIdx, hasNextStep) {
			const nextX = hasNextStep && stepLayouts[stepIdx + 1]
				? stepLayouts[stepIdx + 1].x
				: (stepLayouts[stepIdx].x + stepLayouts[stepIdx].width + colGap)

			let posY = 0
			if (continuationOptIdx !== -1) {
				// Continuation option goes straight to next step at y = 0
				// Options situated BEFORE the continuation option in the list branch UP (negative y)
				// Options situated AFTER the continuation option in the list branch DOWN (positive y)
				const diff = optIdx - continuationOptIdx
				posY = diff * 11.5
			} else {
				// No continuation option (all options jump away or last step):
				// Order strictly from top to bottom according to option order
				posY = optIdx * 11.5
			}
			return { x: nextX, y: posY }
		}

		function getGotoOutboundPos(stepIdx, hasNextStep) {
			const count = outboundStackCount.get(stepIdx) || 0
			outboundStackCount.set(stepIdx, count + 1)
			const nextX = hasNextStep && stepLayouts[stepIdx + 1]
				? stepLayouts[stepIdx + 1].x
				: (stepLayouts[stepIdx].x + stepLayouts[stepIdx].width + colGap)
			const posY = hasNextStep ? (11.5 + count * 11.5) : (count * 11.5)
			return { x: nextX, y: posY }
		}

		steps.forEach((step, idx) => {
			const isGoto = step.type === 'goto'
			const isChoice = step.type === 'choice'
			const isEnd = step.type === 'end'
			const isHold = step.type === 'hold'

			const layout = stepLayouts[idx] || { x: idx * (defaultNodeWidth + colGap), width: defaultNodeWidth, height: nodeHeight }

			let gotoTarget = null
			let isExternalJump = false
			let externalReturnInfo = null
			let isLoop = false
			let targetInternalIndex = -1

			if (isGoto) {
				gotoTarget = step.target || step.id || step.label || step.step || null
				if (gotoTarget) {
					if (idToIndexMap.has(String(gotoTarget))) {
						targetInternalIndex = idToIndexMap.get(String(gotoTarget))
						isLoop = targetInternalIndex < idx
					} else {
						isExternalJump = true
						const currentStoryId = currentStory.value?.id || getCleanScenarioId(selectedFilePath.value)
						const ret = checkScenarioReturn(gotoTarget, currentStoryId)
						if (ret && ret.returns) {
							externalReturnInfo = ret
						} else {
							// Generate Outbound Node for standalone external jump
							const hasNext = idx < steps.length - 1
							const pos = getGotoOutboundPos(idx, hasNext)
							outboundNodes.push({
								id: `outbound_goto_${idx}`,
								target: gotoTarget,
								targetClean: getCleanScenarioId(gotoTarget),
								sourceStepIndex: idx,
								sourceOptionIndex: null,
								optionText: null,
								condition: step.if || step.condition || null,
								x: pos.x,
								y: pos.y,
								width: defaultNodeWidth,
								height: nodeHeight
							})
						}
					}
				}
			}

			const choiceBranches = []
			if (isChoice) {
				const options = step.options || step.choices || []

				// Identify continuation option index (the one continuing to next step in storyline)
				let continuationOptIdx = -1
				for (let oIdx = 0; oIdx < options.length; oIdx++) {
					const opt = options[oIdx]
					let optT = opt.goto || opt.target
					if (!optT && Array.isArray(opt.actions)) {
						const g = opt.actions.find((a) => a.type === 'goto')
						if (g) optT = g.target || g.id
					}
					if (!optT) {
						continuationOptIdx = oIdx
						break
					}
					if (idToIndexMap.has(String(optT)) && idToIndexMap.get(String(optT)) === idx + 1) {
						continuationOptIdx = oIdx
						break
					}
					const currentStoryId = currentStory.value?.id || getCleanScenarioId(selectedFilePath.value)
					const ret = checkScenarioReturn(optT, currentStoryId)
					if (ret && ret.returns) {
						continuationOptIdx = oIdx
						break
					}
				}

				options.forEach((opt, optIdx) => {
					let optTarget = opt.goto || opt.target
					if (!optTarget && Array.isArray(opt.actions)) {
						const g = opt.actions.find((a) => a.type === 'goto')
						if (g) optTarget = g.target || g.id
					}
					let optInternalIndex = -1
					let optExternal = false
					let optLoop = false
					let branchReturnInfo = null
					if (optTarget) {
						if (idToIndexMap.has(String(optTarget))) {
							optInternalIndex = idToIndexMap.get(String(optTarget))
							optLoop = optInternalIndex < idx
						} else {
							optExternal = true
							const currentStoryId = currentStory.value?.id || getCleanScenarioId(selectedFilePath.value)
							const ret = checkScenarioReturn(optTarget, currentStoryId)
							if (ret && ret.returns) {
								branchReturnInfo = ret
							} else {
								// Generate Outbound Node for choice branch with external jump
								const hasNext = idx < steps.length - 1
								const pos = getChoiceOutboundPos(idx, optIdx, continuationOptIdx, hasNext)
								outboundNodes.push({
									id: `outbound_choice_${idx}_${optIdx}`,
									target: optTarget,
									targetClean: getCleanScenarioId(optTarget),
									sourceStepIndex: idx,
									sourceOptionIndex: optIdx,
									optionText: opt.text || `Вариант ${optIdx + 1}`,
									condition: opt.if || opt.condition || null,
									x: pos.x,
									y: pos.y,
									width: defaultNodeWidth,
									height: nodeHeight
								})
							}
						}
					}
					choiceBranches.push({
						optionIndex: optIdx,
						text: opt.text || `Вариант ${optIdx + 1}`,
						disabled: opt.disabled || null,
						condition: opt.if || opt.condition || null,
						target: optTarget,
						targetIndex: optInternalIndex,
						isExternal: optExternal,
						externalReturnInfo: branchReturnInfo,
						isLoop: optLoop
					})
				})
			}

			const x = layout.x
			const y = 0

			nodes.push({
				index: idx,
				id: step.id || `step_${idx}`,
				step,
				type: step.type || (step.variable ? 'variable' : 'custom'),
				x,
				y,
				width: layout.width,
				height: layout.height,
				isGoto,
				gotoTarget,
				isExternalJump,
				externalReturnInfo,
				isLoop,
				targetInternalIndex,
				isChoice,
				choiceBranches,
				isTerminal: isEnd || isHold
			})
		})

		// Connectors / Links
		nodes.forEach((node, idx) => {
			const nextNode = nodes[idx + 1]

			// Sequential link (unless unconditional goto, terminal step, or choice step)
			// For choice steps, individual options connect to their respective targets instead of a single generic line
			if (nextNode && !node.isTerminal && !node.isChoice && !(node.isGoto && !node.step.if && !node.step.condition)) {
				links.push({
					key: `seq_${idx}_${idx + 1}`,
					type: 'sequence',
					fromIndex: idx,
					toIndex: idx + 1,
					startX: node.x + node.width,
					startY: node.y + node.height / 2,
					endX: nextNode.x,
					endY: nextNode.y + nextNode.height / 2,
					condition: nextNode.step.if || nextNode.step.condition || null
				})
			}

			// External goto link to outbound node
			if (node.isGoto && node.isExternalJump && !node.externalReturnInfo) {
				const outNode = outboundNodes.find((o) => o.id === `outbound_goto_${idx}`)
				if (outNode) {
					links.push({
						key: `goto_outbound_${idx}`,
						type: 'goto-outbound',
						fromIndex: idx,
						outboundId: outNode.id,
						startX: node.x + node.width,
						startY: node.y + node.height / 2,
						endX: outNode.x,
						endY: outNode.y + outNode.height / 2,
						target: node.gotoTarget
					})
				}
			}

			// Return link for external goto returning via continue or explicit return
			if (nextNode && node.isGoto && node.isExternalJump && node.externalReturnInfo) {
				links.push({
					key: `return_${idx}_${idx + 1}`,
					type: 'return',
					fromIndex: idx,
					toIndex: idx + 1,
					startX: node.x + node.width,
					startY: node.y + node.height / 2,
					endX: nextNode.x,
					endY: nextNode.y + nextNode.height / 2,
					label: node.externalReturnInfo.label || '↩ continue',
					returnType: node.externalReturnInfo.type
				})
			}

			// Goto links (internal jump or loop)
			if (node.isGoto && node.targetInternalIndex >= 0) {
				const targetNode = nodes[node.targetInternalIndex]
				if (targetNode) {
					links.push({
						key: `goto_${idx}_${node.targetInternalIndex}`,
						type: node.isLoop ? 'loop' : 'jump',
						fromIndex: idx,
						toIndex: node.targetInternalIndex,
						startX: node.x + node.width,
						startY: node.y + node.height / 2,
						endX: targetNode.x,
						endY: targetNode.y + targetNode.height / 2,
						isLoop: node.isLoop,
						targetLabel: node.gotoTarget
					})
				}
			}

			// Choice branches
			if (node.isChoice && node.choiceBranches.length > 0) {
				node.choiceBranches.forEach((branch, bIdx) => {
					// 1. Internal target
					if (branch.targetIndex >= 0) {
						const targetNode = nodes[branch.targetIndex]
						if (targetNode) {
							links.push({
								key: `choice_${idx}_opt_${bIdx}_to_${branch.targetIndex}`,
								type: branch.isLoop ? 'loop' : 'choice',
								optionIndex: bIdx,
								fromIndex: idx,
								toIndex: branch.targetIndex,
								startX: node.x + node.width,
								startY: node.y + 2.0 + bIdx * 1.5,
								endX: targetNode.x,
								endY: targetNode.y + targetNode.height / 2,
								label: branch.text,
								disabled: branch.disabled,
								isLoop: branch.isLoop
							})
						}
					}
					// 2. External target with return (continue)
					else if (branch.isExternal && branch.externalReturnInfo && nextNode) {
						links.push({
							key: `choice_return_${idx}_opt_${bIdx}_to_${idx + 1}`,
							type: 'return',
							optionIndex: bIdx,
							fromIndex: idx,
							toIndex: idx + 1,
							startX: node.x + node.width,
							startY: node.y + 2.0 + bIdx * 1.5,
							endX: nextNode.x,
							endY: nextNode.y + nextNode.height / 2,
							label: `${branch.externalReturnInfo.label || '↩ continue'} (${branch.text})`,
							returnType: branch.externalReturnInfo.type
						})
					}
					// 3. External target without return (leads to Outbound Node)
					else if (branch.isExternal && branch.target) {
						const outNode = outboundNodes.find((o) => o.id === `outbound_choice_${idx}_${bIdx}`)
						if (outNode) {
							links.push({
								key: `choice_outbound_${idx}_opt_${bIdx}`,
								type: 'choice-outbound',
								optionIndex: bIdx,
								fromIndex: idx,
								outboundId: outNode.id,
								startX: node.x + node.width,
								startY: node.y + 2.0 + bIdx * 1.5,
								endX: outNode.x,
								endY: outNode.y + outNode.height / 2,
								label: branch.text,
								target: branch.target
							})
						}
					}
					// 4. Fallthrough branch without goto (continues to next step in storyline)
					else if (nextNode) {
						links.push({
							key: `choice_fallthrough_${idx}_opt_${bIdx}_to_${idx + 1}`,
							type: 'choice-fallthrough',
							optionIndex: bIdx,
							fromIndex: idx,
							toIndex: idx + 1,
							startX: node.x + node.width,
							startY: node.y + 2.0 + bIdx * 1.5,
							endX: nextNode.x,
							endY: nextNode.y + nextNode.height / 2,
							label: branch.text,
							disabled: branch.disabled
						})
					}
				})
			}
		})

		return { nodes, links, outboundNodes }
	}

	// Utility
	function getFileName(filePath) {
		if (!filePath) return ''
		const parts = filePath.split('/')
		return parts[parts.length - 1]
	}

	// Step summary generator for UI timeline badges
	function getStepSummary(step) {
		if (!step || typeof step !== 'object') return 'Пустой шаг'
		if (!step.type && step.variable) {
			return `⚙️ ${step.variable}`
		}

		switch (step.type) {
			case 'dialogue': {
				const idStr = step.id ? `[${step.id}] ` : ''
				if (Array.isArray(step.steps) && step.steps.length > 0) {
					const firstText = (step.steps[0]?.text || '')
						.replace(/<[^>]*>/g, '')
						.replace(/&nbsp;/g, ' ')
						.slice(0, 35)
					return `💬 ${idStr}(${step.steps.length} шагов) "${firstText}${step.steps[0]?.text?.length > 35 ? '...' : ''}"`
				}
				const char = step.character ? `[${step.character}] ` : ''
				const cleanText = (step.text || '')
					.replace(/<[^>]*>/g, '')
					.replace(/&nbsp;/g, ' ')
					.slice(0, 45)
				return `💬 ${idStr}${char}"${cleanText}${step.text?.length > 45 ? '...' : ''}"`
			}
			case 'scene':
				return `🌄 Сцена: ${step.id || step.scene || '?'}${step.mods?.length ? ` (${step.mods.join(', ')})` : ''}`
			case 'show':
				return `👤 Показать: ${step.character || '?'}`
			case 'hide':
				return `👤 Скрыть: ${step.character || '?'}`
			case 'hide-all':
			case 'clear-characters':
				return '👤 Скрыть всех персонажей'
			case 'music':
				return `🎵 Музыка: ${getFileName(step.file)}`
			case 'sound':
				return `🔊 Звук: ${getFileName(step.file)}`
			case 'voice':
				return `🗣️ Озвучка: ${getFileName(step.file)}`
			case 'stop-stream':
				return `⏹️ Стоп стрим: ${step.stream || 'все'}`
			case 'choice':
				return `🔀 Выбор (${step.options?.length || 0} вар.)`
			case 'goto':
				return `➡️ Переход: ${step.target || '?'}`
			case 'titles':
				return `🏷️ Титры: ${(step.text || '').replace(/<[^>]*>/g, '').slice(0, 30)}`
			case 'fade':
			case 'fade-in':
			case 'fade-out':
				return `⬛ Затемнение: ${step.duration || 1}с`
			case 'ui':
				return `🖥️ UI: ${step.action} [${Array.isArray(step.target) ? step.target.join(', ') : step.target}]`
			case 'quest':
				return `📜 Квест: [${step.action}] ${step.title || step.id}`
			case 'notification':
				return `📢 Уведомление: ${(step.text || '').slice(0, 30)}`
			case 'discover-location':
				return `🗺️ Открытие: ${step.map} (${step.locations?.join(', ') || ''})`
			case 'hold':
				return '⏸️ Удержание (hold)'
			case 'continue':
				return '↩️ Продолжить (continue)'
			case 'end':
				return '🛑 Конец (end)'
			default:
				return `⚡ ${step.type}`
		}
	}

	function getStepTypeIcon(step) {
		if (!step || typeof step !== 'object') return '❓'
		if (!step.type && step.variable) return '⚙️'

		const icons = {
			dialogue: '💬',
			scene: '🌄',
			show: '👤',
			hide: '👻',
			'hide-all': '👥',
			'clear-characters': '👥',
			music: '🎵',
			sound: '🔊',
			voice: '🗣️',
			'stop-stream': '⏹️',
			choice: '🔀',
			goto: '➡️',
			variable: '⚙️',
			titles: '🏷️',
			fade: '⬛',
			'fade-in': '⬛',
			'fade-out': '⬛',
			ui: '🖥️',
			quest: '📜',
			notification: '📢',
			'discover-location': '🗺️',
			hold: '⏸️',
			continue: '↩️',
			end: '🛑'
		}
		return icons[step.type] || '⚡'
	}

	return {
		// State
		activeLocale,
		availableLocales,
		fileTree,
		expandedFolders,
		selectedFilePath,
		isLoadingTree,
		isLoadingFile,
		isSaving,
		isDirty,
		searchQuery,
		statusMessage,
		currentStory,
		activeStepIndex,
		activeStep,
		totalStepsCount,
		stepEditMode,
		viewMode,
		navigationHistory,
		canNavigateBack,
		previousScenarioPath,
		isRawFileMode,
		rawFileContent,
		availableCharacters,
		availableScenes,
		availableAudioStreams,
		inboundReferences,

		// Actions
		setStatus,
		toggleFolder,
		isFolderExpanded,
		loadFileTree,
		loadStoryFile,
		saveStoryFile,
		createStoryFile,
		createStoryFolder,
		deleteStoryItem,
		addStep,
		duplicateStep,
		removeStep,
		moveStep,
		updateActiveStep,
		updateStepType,
		switchLocale,
		getFileName,
		getStepSummary,
		getStepTypeIcon,
		resolveScenarioPath,
		jumpToScenario,
		navigateBack,
		buildStoryGraph,
		normalizeStoryPath,
		getCleanScenarioId,
		readStoryFile,
		checkScenarioReturn,
		scanInboundReferences
	}
}
