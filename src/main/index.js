// src/main/index.js

import { app, shell, BrowserWindow, ipcMain, protocol, session } from 'electron'
import { join, normalize } from 'path'
import fs from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import installExtension, { VUEJS_DEVTOOLS } from 'electron-devtools-installer'

// Import icon path
const icon = is.dev
	? join(__dirname, '../../build/icon.png')
	: join(process.resourcesPath, 'icon.png')

// Проверка и создание settings.json
async function ensureSettingsFile() {
	const userDir = app.getPath('userData')
	const userFile = join(userDir, 'settings.json')
	const defaultFile = join(__dirname, '../renderer/settings.def.json')

	try {
		await fs.access(userFile)
	} catch {
		try {
			const data = await fs.readFile(defaultFile, 'utf-8')
			await fs.mkdir(userDir, { recursive: true })
			await fs.writeFile(userFile, data, 'utf-8')
			console.log('✔ settings.json создан из шаблона.')
		} catch (err) {
			console.error('⛔ Ошибка при создании settings.json:', err)
		}
	}
}

// IPC для работы с настройками
ipcMain.handle('get-settings', async (_event, type) => {
	let file
	if (type === 'default') {
		file = is.dev
			? join(__dirname, '../renderer/settings.def.json')
			: join(process.resourcesPath, 'app', 'out', 'renderer', 'settings.def.json')
	} else {
		file = join(app.getPath('userData'), 'settings.json')
	}
	const text = await fs.readFile(file, 'utf-8')
	return JSON.parse(text)
})

ipcMain.on('save-settings', async (_event, newSettings) => {
	const file = join(app.getPath('userData'), 'settings.json')
	await fs.writeFile(file, JSON.stringify(newSettings, null, 2), 'utf-8')
})

ipcMain.on('close-window', (event) => {
	const win = BrowserWindow.fromWebContents(event.sender)
	if (win) win.close()
})

ipcMain.on('set-fullscreen', (event, flag) => {
	const win = BrowserWindow.fromWebContents(event.sender)
	if (win) win.setFullScreen(!!flag)
})

// Пример: список файлов в папке
ipcMain.handle('list-files', async (_event, folderPath) => {
	try {
		const audioFiles = []

		// Функция для рекурсивного сканирования папки
		async function scanDirectory(dirPath, relativePath = '') {
			const entries = await fs.readdir(dirPath, { withFileTypes: true })

			for (const entry of entries) {
				const fullPath = join(dirPath, entry.name)
				const relativeFilePath = join(relativePath, entry.name)

				if (entry.isDirectory()) {
					// Рекурсивно сканируем подпапки
					await scanDirectory(fullPath, relativeFilePath)
				} else if (entry.isFile()) {
					// Проверяем, является ли файл аудиофайлом
					const ext = entry.name.toLowerCase().split('.').pop()
					if (ext && ['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) {
						// Возвращаем путь относительно public папки для правильной работы с Vite dev server
						const relativeToPubic = folderPath + relativeFilePath.replace(/\\/g, '/')
						audioFiles.push(relativeToPubic)
					}
				}
			}
		}

		// Строим абсолютный путь к папке с файлами
		const fullPath = is.dev
			? join(__dirname, '../../src/renderer/public', folderPath)
			: join(process.resourcesPath, 'app', 'out', 'renderer', folderPath)

		console.log(`Scanning audio directory: ${fullPath}`)
		await scanDirectory(fullPath)
		console.log(`Found ${audioFiles.length} audio files:`, audioFiles)
		return audioFiles
	} catch (e) {
		console.error('Error scanning audio directory:', e)
		return []
	}
})

ipcMain.on('set-resolution', (event, resolution) => {
	const win = BrowserWindow.fromWebContents(event.sender)
	if (win) {
		// Не менять размер, если fullscreen
		if (!win.isFullScreen()) {
			const [w, h] = resolution.split('x').map(Number)
			if (w && h) win.setSize(w, h)
		}
	}
})

// IPC для сохранения/загрузки игры с поддержкой профилей персонажей (Skyrim style)
async function getSavesDirectory() {
	const userDir = app.getPath('userData')
	const savesDir = join(userDir, 'saves')
	try {
		await fs.mkdir(savesDir, { recursive: true })
	} catch (err) {
		console.error('Ошибка при создании папки saves:', err)
	}
	return savesDir
}

function sanitizeFolderName(name) {
	if (!name || typeof name !== 'string') return 'Player'
	let clean = name.replace(/[\\/:*?"<>|\x00-\x1F]/g, '_').trim()
	clean = clean.replace(/^[.\s]+|[.\s]+$/g, '')
	return clean.slice(0, 32) || 'Player'
}

async function getNextProfileNumber(savesDir) {
	try {
		const entries = await fs.readdir(savesDir, { withFileTypes: true })
		let maxNum = 0
		for (const entry of entries) {
			if (entry.isDirectory()) {
				const m = entry.name.match(/^(\d+)(?:_.*)?$/)
				if (m) {
					const num = parseInt(m[1], 10)
					if (!isNaN(num) && num > maxNum) {
						maxNum = num
					}
				}
			}
		}
		return maxNum + 1
	} catch (err) {
		console.warn('getNextProfileNumber error:', err)
		return 1
	}
}

// ── Профили сохранений ────────────────────────────────────────────────────────
ipcMain.handle('list-profiles', async (_event) => {
	try {
		const savesDir = await getSavesDirectory()
		const entries = await fs.readdir(savesDir, { withFileTypes: true })
		const profiles = []

		for (const entry of entries) {
			if (entry.isDirectory()) {
				const folderName = entry.name
				const profileDirPath = join(savesDir, folderName)
				const numMatch = folderName.match(/^(\d+)(?:_(.*))?$/)

				let profileData = null
				const profileJsonPath = join(profileDirPath, 'profile.json')
				try {
					const content = await fs.readFile(profileJsonPath, 'utf-8')
					profileData = JSON.parse(content)
				} catch {
					profileData = {
						id: numMatch ? parseInt(numMatch[1], 10) : profiles.length + 1,
						folder: folderName,
						name: numMatch && numMatch[2] ? numMatch[2] : folderName,
						createdAt: Date.now(),
						updatedAt: Date.now()
					}
				}

				let saveCount = 0
				let latestTimestamp = profileData.updatedAt || 0
				let latestScreenshot = null
				let latestSlot = null

				try {
					const files = await fs.readdir(profileDirPath, { withFileTypes: true })
					for (const file of files) {
						if (file.isFile() && file.name.endsWith('.json') && file.name !== 'profile.json') {
							saveCount++
							try {
								const savePath = join(profileDirPath, file.name)
								const sContent = await fs.readFile(savePath, 'utf-8')
								const sData = JSON.parse(sContent)
								if (sData.timestamp && sData.timestamp > latestTimestamp) {
									latestTimestamp = sData.timestamp
									latestScreenshot = sData.screenshot || null
									latestSlot = sData.slot
								}
							} catch (e) {
								console.warn(`Ошибка чтения метаданных сейва ${file.name}:`, e)
							}
						}
					}
				} catch (e) {
					console.warn(`Ошибка чтения папки профиля ${folderName}:`, e)
				}

				profiles.push({
					id: profileData.id ?? (numMatch ? parseInt(numMatch[1], 10) : 1),
					folder: folderName,
					name: profileData.name || (numMatch && numMatch[2]) || folderName,
					createdAt: profileData.createdAt || latestTimestamp || Date.now(),
					updatedAt: latestTimestamp || profileData.updatedAt || Date.now(),
					saveCount,
					latestScreenshot,
					latestSlot
				})
			}
		}

		// Поддержка существующих файлов сейвов в корневой папке (legacy)
		const rootSaves = entries.filter((e) => e.isFile() && e.name.endsWith('.json'))
		if (rootSaves.length > 0) {
			let latestTimestamp = 0
			let latestScreenshot = null
			for (const f of rootSaves) {
				try {
					const sPath = join(savesDir, f.name)
					const sContent = await fs.readFile(sPath, 'utf-8')
					const sData = JSON.parse(sContent)
					if (sData.timestamp && sData.timestamp > latestTimestamp) {
						latestTimestamp = sData.timestamp
						latestScreenshot = sData.screenshot || null
					}
				} catch {}
			}
			profiles.push({
				id: 0,
				folder: '',
				name: 'Общий (Legacy)',
				createdAt: 0,
				updatedAt: latestTimestamp || Date.now(),
				saveCount: rootSaves.length,
				latestScreenshot,
				isLegacy: true
			})
		}

		// Сортировка: самые свежие профили сверху
		profiles.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
		return { success: true, data: profiles }
	} catch (error) {
		console.error('⛔ Ошибка при получении списка профилей:', error)
		return { success: false, error: error.message }
	}
})

ipcMain.handle('create-profile', async (_event, characterName) => {
	try {
		const savesDir = await getSavesDirectory()
		const nextNum = await getNextProfileNumber(savesDir)
		const safeName = sanitizeFolderName(characterName)
		const folderName = `${nextNum}_${safeName}`
		const profileDirPath = join(savesDir, folderName)

		await fs.mkdir(profileDirPath, { recursive: true })

		const profileData = {
			id: nextNum,
			folder: folderName,
			name: characterName ? characterName.trim() : safeName,
			createdAt: Date.now(),
			updatedAt: Date.now()
		}

		const profileJsonPath = join(profileDirPath, 'profile.json')
		await fs.writeFile(profileJsonPath, JSON.stringify(profileData, null, 2), 'utf-8')

		console.log(`✔ Номерной профиль создан: ${folderName}`)
		return { success: true, data: profileData }
	} catch (error) {
		console.error('⛔ Ошибка при создании профиля:', error)
		return { success: false, error: error.message }
	}
})

ipcMain.handle('delete-profile', async (_event, profileFolder) => {
	try {
		if (!profileFolder) {
			return { success: false, error: 'Не указана папка профиля' }
		}
		const savesDir = await getSavesDirectory()
		const profileDirPath = join(savesDir, profileFolder)

		const normalizedSaves = normalize(savesDir)
		const normalizedTarget = normalize(profileDirPath)
		if (!normalizedTarget.startsWith(normalizedSaves) || normalizedTarget === normalizedSaves) {
			return { success: false, error: 'Недопустимый путь к профилю' }
		}

		await fs.rm(profileDirPath, { recursive: true, force: true })
		console.log(`✔ Профиль удалён: ${profileFolder}`)
		return { success: true }
	} catch (error) {
		console.error('⛔ Ошибка при удалении профиля:', error)
		return { success: false, error: error.message }
	}
})

// ── Сохранение / Загрузка игр ────────────────────────────────────────────────
ipcMain.handle('save-game', async (event, slotNumber, saveFile, clipRect, profileFolder) => {
	try {
		const savesDir = await getSavesDirectory()
		const targetFolder = profileFolder || saveFile.profileFolder || ''
		const targetDir = targetFolder ? join(savesDir, targetFolder) : savesDir

		await fs.mkdir(targetDir, { recursive: true })

		const { mcName } = saveFile

		// Capture window screenshot for save slot thumbnail
		const win = BrowserWindow.fromWebContents(event.sender)
		if (win) {
			try {
				let image
				if (clipRect && clipRect.width > 0 && clipRect.height > 0) {
					image = await win.webContents.capturePage(clipRect)
				} else {
					image = await win.webContents.capturePage()
				}
				const thumbnail = image.resize({ width: 320 })
				saveFile.screenshot = thumbnail.toDataURL('image/jpeg', 80)
				console.log(`✔ Скриншот для сейва в слоте ${slotNumber} успешно создан`)
			} catch (e) {
				console.warn(`Не удалось создать скриншот для сейва ${slotNumber}:`, e)
			}
		}

		if (targetFolder) {
			saveFile.profileFolder = targetFolder
		}

		// Remove any existing files for this slot in targetDir to avoid duplicates
		try {
			const existing = await fs.readdir(targetDir, { withFileTypes: true })
			for (const entry of existing) {
				if (entry.isFile() && entry.name !== 'profile.json') {
					const m = entry.name.match(/^(\d+)_/)
					if (m && parseInt(m[1], 10) === slotNumber) {
						const oldPath = join(targetDir, entry.name)
						try {
							await fs.unlink(oldPath)
							console.log(`✔ Удалено старое сохранение: ${entry.name}`)
						} catch (e) {
							console.warn(`Не удалось удалить старое сохранение ${entry.name}:`, e)
						}
					}
				}
			}
		} catch (err) {
			console.warn('Ошибка при проверке/удалении старых сохранений:', err)
		}

		const safeMcName = sanitizeFolderName(mcName)
		const fileName = `${slotNumber}_${safeMcName}_${saveFile.timestampFormatted}.json`
		const filePath = join(targetDir, fileName)

		await fs.writeFile(filePath, JSON.stringify(saveFile, null, 2), 'utf-8')
		console.log(`✔ Сохранение создано: ${fileName} в ${targetDir}`)

		// Обновляем время профиля
		if (targetFolder) {
			try {
				const pJsonPath = join(targetDir, 'profile.json')
				let pData = {}
				try {
					pData = JSON.parse(await fs.readFile(pJsonPath, 'utf-8'))
				} catch {}
				pData.updatedAt = Date.now()
				await fs.writeFile(pJsonPath, JSON.stringify(pData, null, 2), 'utf-8')
			} catch {}
		}

		return { success: true, data: saveFile }
	} catch (error) {
		console.error('⛔ Ошибка при сохранении:', error)
		return { success: false, error: error.message }
	}
})

ipcMain.handle('load-game', async (_event, slotNumber, profileFolder) => {
	try {
		const savesDir = await getSavesDirectory()

		// Если указана папка профиля, ищем сначала в ней
		if (profileFolder) {
			const targetDir = join(savesDir, profileFolder)
			try {
				const entries = await fs.readdir(targetDir, { withFileTypes: true })
				const saveFile = entries.find((entry) => {
					const nameMatch = entry.name.match(/^(\d+)_/)
					return entry.isFile() && nameMatch && parseInt(nameMatch[1], 10) === slotNumber
				})
				if (saveFile) {
					const filePath = join(targetDir, saveFile.name)
					const data = await fs.readFile(filePath, 'utf-8')
					const saveData = JSON.parse(data)
					saveData.profileFolder = profileFolder
					console.log(`✔ Сохранение загружено из ${profileFolder}: ${saveFile.name}`)
					return { success: true, data: saveData }
				}
			} catch (e) {
				console.warn(`Поиск в ${profileFolder} завершился с ошибкой:`, e)
			}
		}

		// Fallback: ищем в корневой папке
		const rootEntries = await fs.readdir(savesDir, { withFileTypes: true })
		const rootSave = rootEntries.find((entry) => {
			const nameMatch = entry.name.match(/^(\d+)_/)
			return entry.isFile() && nameMatch && parseInt(nameMatch[1], 10) === slotNumber
		})
		if (rootSave) {
			const filePath = join(savesDir, rootSave.name)
			const data = await fs.readFile(filePath, 'utf-8')
			const saveData = JSON.parse(data)
			saveData.profileFolder = ''
			console.log(`✔ Сохранение загружено из корня: ${rootSave.name}`)
			return { success: true, data: saveData }
		}

		// Fallback: ищем во всех подпапках профилей
		for (const entry of rootEntries) {
			if (entry.isDirectory()) {
				const subDir = join(savesDir, entry.name)
				try {
					const subEntries = await fs.readdir(subDir, { withFileTypes: true })
					const subSave = subEntries.find((e) => {
						const nameMatch = e.name.match(/^(\d+)_/)
						return e.isFile() && nameMatch && parseInt(nameMatch[1], 10) === slotNumber
					})
					if (subSave) {
						const filePath = join(subDir, subSave.name)
						const data = await fs.readFile(filePath, 'utf-8')
						const saveData = JSON.parse(data)
						saveData.profileFolder = entry.name
						console.log(`✔ Сохранение найдено в ${entry.name}: ${subSave.name}`)
						return { success: true, data: saveData }
					}
				} catch {}
			}
		}

		return { success: false, error: 'Сохранение не найдено' }
	} catch (error) {
		console.error('⛔ Ошибка при загрузке:', error)
		return { success: false, error: error.message }
	}
})

ipcMain.handle('list-saves', async (_event, profileFolder) => {
	try {
		const savesDir = await getSavesDirectory()
		const savesMap = new Map()

		async function readSavesFromDir(dirPath, folderName) {
			try {
				const entries = await fs.readdir(dirPath, { withFileTypes: true })
				for (const entry of entries) {
					if (entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'profile.json') {
						const nameMatch = entry.name.match(/^(\d+)_/)
						if (!nameMatch) continue

						const slot = parseInt(nameMatch[1], 10)
						const filePath = join(dirPath, entry.name)
						try {
							const data = await fs.readFile(filePath, 'utf-8')
							const saveData = JSON.parse(data)
							saveData.slot = slot
							saveData.profileFolder = folderName || ''

							const key = folderName ? `${folderName}_${slot}` : `${slot}`
							if (!savesMap.has(key) || saveData.timestamp > savesMap.get(key).timestamp) {
								savesMap.set(key, saveData)
							}
						} catch (err) {
							console.warn(`Ошибка при чтении ${entry.name}:`, err)
						}
					}
				}
			} catch (err) {
				console.warn(`Ошибка чтения директории ${dirPath}:`, err)
			}
		}

		if (profileFolder && profileFolder !== 'all') {
			await readSavesFromDir(join(savesDir, profileFolder), profileFolder)
		} else {
			// Читаем корневые и все подпапки
			await readSavesFromDir(savesDir, '')
			const entries = await fs.readdir(savesDir, { withFileTypes: true })
			for (const entry of entries) {
				if (entry.isDirectory()) {
					await readSavesFromDir(join(savesDir, entry.name), entry.name)
				}
			}
		}

		const saves = Array.from(savesMap.values()).sort((a, b) => {
			if (a.slot !== b.slot) return a.slot - b.slot
			return b.timestamp - a.timestamp
		})
		console.log(`✔ Найдено ${saves.length} сохранений (фильтр: ${profileFolder || 'все'})`)
		return { success: true, data: saves }
	} catch (error) {
		console.error('⛔ Ошибка при получении списка сохранений:', error)
		return { success: false, error: error.message }
	}
})

ipcMain.handle('delete-save', async (_event, slotNumber, profileFolder) => {
	try {
		const savesDir = await getSavesDirectory()
		const targetDir = profileFolder ? join(savesDir, profileFolder) : savesDir
		const entries = await fs.readdir(targetDir, { withFileTypes: true })

		const saveFile = entries.find((entry) => {
			const nameMatch = entry.name.match(/^(\d+)_/)
			return entry.isFile() && nameMatch && parseInt(nameMatch[1], 10) === slotNumber
		})

		if (!saveFile) {
			return { success: false, error: 'Сохранение не найдено' }
		}

		const filePath = join(targetDir, saveFile.name)
		await fs.unlink(filePath)

		console.log(`✔ Сохранение удалено: ${saveFile.name} из ${targetDir}`)
		return { success: true }
	} catch (error) {
		console.error('⛔ Ошибка при удалении:', error)
		return { success: false, error: error.message }
	}
})

// ==========================================
// IPC для Редактора данных (Data Editor)
// ==========================================
function getDataDirectory() {
	return is.dev
		? join(__dirname, '../../src/renderer/public/data')
		: join(process.resourcesPath, 'app', 'out', 'renderer', 'data')
}

ipcMain.handle('data-editor-get-info', async () => {
	const dir = getDataDirectory()
	return { basePath: dir, isDev: is.dev }
})

ipcMain.handle('data-editor-read-file', async (_event, relativePath) => {
	try {
		const baseDir = getDataDirectory()
		const filePath = join(baseDir, relativePath)
		const content = await fs.readFile(filePath, 'utf-8')
		return { success: true, data: JSON.parse(content), path: filePath }
	} catch (error) {
		if (error.code === 'ENOENT') {
			return { success: false, notFound: true, error: 'Файл не найден' }
		}
		console.error(`⛔ Ошибка при чтении файла данных ${relativePath}:`, error)
		return { success: false, error: error.message }
	}
})

ipcMain.handle('data-editor-write-file', async (_event, relativePath, data) => {
	try {
		const baseDir = getDataDirectory()
		const filePath = join(baseDir, relativePath)
		const dir = join(filePath, '..')
		await fs.mkdir(dir, { recursive: true })
		const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
		await fs.writeFile(filePath, content, 'utf-8')
		console.log(`✔ Файл данных сохранён: ${filePath}`)
		return { success: true, path: filePath }
	} catch (error) {
		console.error(`⛔ Ошибка при записи файла данных ${relativePath}:`, error)
		return { success: false, error: error.message }
	}
})

ipcMain.handle('data-editor-delete-file', async (_event, relativePath) => {
	try {
		const baseDir = getDataDirectory()
		const filePath = join(baseDir, relativePath)
		await fs.unlink(filePath)
		console.log(`✔ Файл данных удалён: ${filePath}`)
		return { success: true, path: filePath }
	} catch (error) {
		console.error(`⛔ Ошибка при удалении файла данных ${relativePath}:`, error)
		return { success: false, error: error.message }
	}
})

ipcMain.handle('data-editor-list-files', async (_event, relativeDir) => {
	try {
		const baseDir = getDataDirectory()
		const dirPath = join(baseDir, relativeDir)
		try {
			const entries = await fs.readdir(dirPath)
			return { success: true, files: entries }
		} catch (err) {
			if (err.code === 'ENOENT') {
				return { success: true, files: [] }
			}
			throw err
		}
	} catch (error) {
		console.error(`⛔ Ошибка при чтении списка файлов ${relativeDir}:`, error)
		return { success: false, error: error.message, files: [] }
	}
})

ipcMain.handle('data-editor-list-tree', async (_event, relativeDir = '') => {
	try {
		const baseDir = getDataDirectory()
		const targetDir = join(baseDir, relativeDir)

		async function scanDirectory(dir, relPath = '') {
			const entries = await fs.readdir(dir, { withFileTypes: true })
			const items = []
			for (const entry of entries) {
				const itemRelPath = relPath ? `${relPath}/${entry.name}` : entry.name
				if (entry.isDirectory()) {
					const children = await scanDirectory(join(dir, entry.name), itemRelPath)
					items.push({
						name: entry.name,
						isDirectory: true,
						path: itemRelPath,
						children
					})
				} else if (entry.isFile() && entry.name.endsWith('.json')) {
					items.push({
						name: entry.name,
						isDirectory: false,
						path: itemRelPath
					})
				}
			}
			items.sort((a, b) => {
				if (a.isDirectory && !b.isDirectory) return -1
				if (!a.isDirectory && b.isDirectory) return 1
				return a.name.localeCompare(b.name)
			})
			return items
		}

		try {
			const tree = await scanDirectory(targetDir, relativeDir)
			return { success: true, tree }
		} catch (err) {
			if (err.code === 'ENOENT') {
				return { success: true, tree: [] }
			}
			throw err
		}
	} catch (error) {
		console.error(`⛔ Ошибка при чтении дерева каталогов ${relativeDir}:`, error)
		return { success: false, error: error.message, tree: [] }
	}
})

ipcMain.handle('data-editor-create-dir', async (_event, relativeDir) => {
	try {
		const baseDir = getDataDirectory()
		const dirPath = join(baseDir, relativeDir)
		await fs.mkdir(dirPath, { recursive: true })
		console.log(`✔ Каталог создан: ${dirPath}`)
		return { success: true, path: dirPath }
	} catch (error) {
		console.error(`⛔ Ошибка при создании каталога ${relativeDir}:`, error)
		return { success: false, error: error.message }
	}
})

ipcMain.handle('data-editor-delete-dir', async (_event, relativeDir) => {
	try {
		const baseDir = getDataDirectory()
		const dirPath = join(baseDir, relativeDir)
		await fs.rm(dirPath, { recursive: true, force: true })
		console.log(`✔ Каталог удалён: ${dirPath}`)
		return { success: true, path: dirPath }
	} catch (error) {
		console.error(`⛔ Ошибка при удалении каталога ${relativeDir}:`, error)
		return { success: false, error: error.message }
	}
})

ipcMain.handle('data-editor-copy-locale', async (_event, params) => {
	try {
		const {
			sourceLang = 'ru',
			targetLang,
			targetLabel,
			targetFlag,
			copyEntities = true,
			copyStory = true
		} = params || {}

		const cleanTarget = String(targetLang || '').trim().toLowerCase()
		if (!cleanTarget) throw new Error('Код языка не указан')
		if (!/^[a-z]{2,5}(-[a-z0-9]+)?$/i.test(cleanTarget)) {
			throw new Error('Код языка должен состоять из 2-5 латинских букв (например: de, ja, zh)')
		}

		const baseDir = getDataDirectory()
		let copiedEntitiesCount = 0
		let copiedStoryCount = 0

		// 1. Copy Entity Locales (locales/{source} -> locales/{target})
		if (copyEntities) {
			const sourceLocaleDir = join(baseDir, 'locales', sourceLang)
			const targetLocaleDir = join(baseDir, 'locales', cleanTarget)
			await fs.mkdir(targetLocaleDir, { recursive: true })

			try {
				const entries = await fs.readdir(sourceLocaleDir, { withFileTypes: true })
				for (const entry of entries) {
					if (entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'locales.json') {
						const srcFile = join(sourceLocaleDir, entry.name)
						const destFile = join(targetLocaleDir, entry.name)
						await fs.copyFile(srcFile, destFile)
						copiedEntitiesCount++
					}
				}
			} catch (err) {
				console.warn(`[data-editor-copy-locale] Ошибка копирования словарей сущностей:`, err)
			}
		}

		// 2. Copy Story Scenarios (story/{source} -> story/{target})
		if (copyStory) {
			const sourceStoryDir = join(baseDir, 'story', sourceLang)
			const targetStoryDir = join(baseDir, 'story', cleanTarget)

			async function copyDirRecursive(src, dest) {
				await fs.mkdir(dest, { recursive: true })
				const entries = await fs.readdir(src, { withFileTypes: true })
				let count = 0
				for (const entry of entries) {
					const srcPath = join(src, entry.name)
					const destPath = join(dest, entry.name)
					if (entry.isDirectory()) {
						count += await copyDirRecursive(srcPath, destPath)
					} else if (entry.isFile()) {
						await fs.copyFile(srcPath, destPath)
						count++
					}
				}
				return count
			}

			try {
				const stat = await fs.stat(sourceStoryDir)
				if (stat.isDirectory()) {
					copiedStoryCount = await copyDirRecursive(sourceStoryDir, targetStoryDir)
				}
			} catch (err) {
				console.warn(`[data-editor-copy-locale] Исходная папка сценариев не найдена: ${sourceStoryDir}`)
			}
		}

		// 3. Update locales/locales.json
		const registryPath = join(baseDir, 'locales', 'locales.json')
		let localesRegistry = []
		try {
			const regContent = await fs.readFile(registryPath, 'utf-8')
			localesRegistry = JSON.parse(regContent)
			if (!Array.isArray(localesRegistry)) localesRegistry = []
		} catch {
			localesRegistry = [
				{ code: 'ru', label: 'Русский', flag: '🇷🇺', isDefault: true },
				{ code: 'en', label: 'English', flag: '🇬🇧' }
			]
		}

		const existingIdx = localesRegistry.findIndex((l) => l.code === cleanTarget)
		const newLocaleItem = {
			code: cleanTarget,
			label: String(targetLabel || cleanTarget.toUpperCase()).trim(),
			flag: String(targetFlag || '🌐').trim()
		}

		if (existingIdx >= 0) {
			localesRegistry[existingIdx] = { ...localesRegistry[existingIdx], ...newLocaleItem }
		} else {
			localesRegistry.push(newLocaleItem)
		}

		await fs.writeFile(registryPath, JSON.stringify(localesRegistry, null, 2), 'utf-8')
		console.log(`✔ Локализация «${newLocaleItem.label}» (${cleanTarget}) успешно создана на основе «${sourceLang}»!`)

		return {
			success: true,
			locale: newLocaleItem,
			copiedEntitiesCount,
			copiedStoryCount,
			locales: localesRegistry
		}
	} catch (error) {
		console.error('⛔ Ошибка при копировании локализации:', error)
		return { success: false, error: error.message }
	}
})

ipcMain.handle('data-editor-list-locales', async () => {
	try {
		const baseDir = getDataDirectory()
		const registryPath = join(baseDir, 'locales', 'locales.json')
		let registry = []
		try {
			const regContent = await fs.readFile(registryPath, 'utf-8')
			registry = JSON.parse(regContent)
			if (!Array.isArray(registry)) registry = []
		} catch {
			registry = [
				{ code: 'ru', label: 'Русский', flag: '🇷🇺', isDefault: true },
				{ code: 'en', label: 'English', flag: '🇬🇧' }
			]
		}

		const enriched = await Promise.all(
			registry.map(async (loc) => {
				let entityFiles = 0
				let storyFiles = 0
				try {
					const entDir = join(baseDir, 'locales', loc.code)
					const files = await fs.readdir(entDir)
					entityFiles = files.filter((f) => f.endsWith('.json') && f !== 'locales.json').length
				} catch {}

				try {
					const storyDir = join(baseDir, 'story', loc.code)
					async function countFiles(dir) {
						let c = 0
						const list = await fs.readdir(dir, { withFileTypes: true })
						for (const item of list) {
							if (item.isDirectory()) c += await countFiles(join(dir, item.name))
							else if (item.isFile() && item.name.endsWith('.json')) c++
						}
						return c
					}
					storyFiles = await countFiles(storyDir)
				} catch {}

				return {
					...loc,
					entityFiles,
					storyFiles,
					isDefault: loc.code === 'ru' || !!loc.isDefault
				}
			})
		)

		return { success: true, locales: enriched }
	} catch (error) {
		console.error('⛔ Ошибка при получении списка локалей:', error)
		return { success: false, error: error.message }
	}
})

ipcMain.handle('data-editor-delete-locale', async (_event, lang) => {
	try {
		const cleanLang = String(lang || '').trim().toLowerCase()
		if (!cleanLang) throw new Error('Код языка не указан')
		if (cleanLang === 'ru') throw new Error('Нельзя удалить основной язык (Русский)')

		const baseDir = getDataDirectory()

		// 1. Remove locales/{lang}
		const locDir = join(baseDir, 'locales', cleanLang)
		try {
			await fs.rm(locDir, { recursive: true, force: true })
		} catch (err) {
			console.warn(`[data-editor-delete-locale] Папка локали не найдена: ${locDir}`)
		}

		// 2. Remove story/{lang} if exists
		const storyDir = join(baseDir, 'story', cleanLang)
		try {
			await fs.rm(storyDir, { recursive: true, force: true })
		} catch {}

		// 3. Update locales/locales.json
		const registryPath = join(baseDir, 'locales', 'locales.json')
		let registry = []
		try {
			const regContent = await fs.readFile(registryPath, 'utf-8')
			registry = JSON.parse(regContent)
			if (Array.isArray(registry)) {
				registry = registry.filter((l) => l.code !== cleanLang)
				await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf-8')
			}
		} catch {}

		console.log(`✔ Локализация «${cleanLang}» удалена`)
		return { success: true, locales: registry }
	} catch (error) {
		console.error('⛔ Ошибка при удалении локализации:', error)
		return { success: false, error: error.message }
	}
})


async function getInitialSettings() {
	const file = join(app.getPath('userData'), 'settings.json')
	const text = await fs.readFile(file, 'utf-8')
	return JSON.parse(text)
}

async function installDevTools() {
	if (is.dev) {
		try {
			if (session.defaultSession.extensions) {
				session.defaultSession.getAllExtensions = () =>
					session.defaultSession.extensions.getAllExtensions()
				session.defaultSession.loadExtension = (path, opts) =>
					session.defaultSession.extensions.loadExtension(path, opts)
				session.defaultSession.removeExtension = (id) =>
					session.defaultSession.extensions.removeExtension(id)
			}
			await installExtension(VUEJS_DEVTOOLS)
			console.log('✔ Vue DevTools успешно установлены')
		} catch (err) {
			console.error('⛔ Ошибка при установке Vue DevTools:', err)
		}
	}
}

async function createWindow() {
	const settings = await getInitialSettings()
	let width = 900,
		height = 670
	if (settings?.video?.resolution) {
		const [w, h] = String(settings.video.resolution).split('x').map(Number)
		if (w && h) {
			width = w
			height = h
		}
	}
	const fullscreen = !!settings?.video?.fullscreen

	const mainWindow = new BrowserWindow({
		width,
		height,
		fullscreen,
		show: false,
		autoHideMenuBar: true,
		icon: icon, // Use icon on all platforms
		webPreferences: {
			preload: join(__dirname, '../preload/index.js'),
			sandbox: false,
			devTools: true
		}
	})

	mainWindow.once('ready-to-show', () => {
		console.log('🚀 Окно игры готово и отображено!')
		mainWindow.show()
		// Открывать DevTools только в dev-режиме
		if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
			mainWindow.webContents.openDevTools({ mode: 'detach' })
		}
	})

	mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
		console.error(`⛔ Ошибка загрузки URL: ${validatedURL} (${errorCode}: ${errorDescription})`)
	})

	mainWindow.webContents.setWindowOpenHandler((details) => {
		shell.openExternal(details.url)
		return { action: 'deny' }
	})

	mainWindow.webContents.on('before-input-event', (event, input) => {
		if (
			(input.key === 'F12' && input.type === 'keyDown') ||
			(input.control &&
				input.shift &&
				input.key.toLowerCase() === 'i' &&
				input.type === 'keyDown')
		) {
			mainWindow.webContents.openDevTools({ mode: 'detach' })
			event.preventDefault()
		}
		// Добавить поддержку F5 и Ctrl+R для dev-режима
		if (
			is.dev &&
			((input.key === 'F5' && input.type === 'keyDown') ||
				(input.control && input.key.toLowerCase() === 'r' && input.type === 'keyDown'))
		) {
			mainWindow.reload()
			event.preventDefault()
		}
	})

	if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
		mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
	} else {
		mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
	}
}

app.whenReady().then(async () => {
	electronApp.setAppUserModelId('com.electron')
	await ensureSettingsFile()
	await installDevTools()

	// Register protocol to serve static files
	if (!is.dev) {
		protocol.registerFileProtocol('file', (request, callback) => {
			const url = new URL(request.url)
			const filePath = decodeURIComponent(url.pathname)
			callback(filePath)
		})
	}

	app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))
	createWindow()
	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow()
	})
})

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit()
})
