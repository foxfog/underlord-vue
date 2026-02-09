// src/main/index.js

import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import fs from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

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

// IPC для сохранения/загрузки игры
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

ipcMain.handle('save-game', async (_event, slotNumber, saveFile) => {
	try {
		const savesDir = await getSavesDirectory()
		const { mcName, timestamp } = saveFile
		// Remove any existing files for this slot to avoid duplicates
		try {
			const existing = await fs.readdir(savesDir, { withFileTypes: true })
			for (const entry of existing) {
				if (entry.isFile()) {
					const m = entry.name.match(/^(\d+)_/)
					if (m && parseInt(m[1]) === slotNumber) {
						const oldPath = join(savesDir, entry.name)
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

		const fileName = `${slotNumber}_${mcName}_${saveFile.timestampFormatted}.json`
		const filePath = join(savesDir, fileName)
		
		await fs.writeFile(filePath, JSON.stringify(saveFile, null, 2), 'utf-8')
		console.log(`✔ Сохранение создано: ${fileName}`)
		return { success: true, data: saveFile }
	} catch (error) {
		console.error('⛔ Ошибка при сохранении:', error)
		return { success: false, error: error.message }
	}
})

ipcMain.handle('load-game', async (_event, slotNumber) => {
	try {
		const savesDir = await getSavesDirectory()
		const entries = await fs.readdir(savesDir, { withFileTypes: true })
		
		// Найти файл сохранения с нужным номером слота
		const saveFile = entries.find(entry => {
			const nameMatch = entry.name.match(/^(\d+)_/)
			return entry.isFile() && nameMatch && parseInt(nameMatch[1]) === slotNumber
		})
		
		if (!saveFile) {
			return { success: false, error: 'Сохранение не найдено' }
		}
		
		const filePath = join(savesDir, saveFile.name)
		const data = await fs.readFile(filePath, 'utf-8')
		const saveData = JSON.parse(data)
		
		console.log(`✔ Сохранение загружено: ${saveFile.name}`)
		return { success: true, data: saveData }
	} catch (error) {
		console.error('⛔ Ошибка при загрузке:', error)
		return { success: false, error: error.message }
	}
})

ipcMain.handle('list-saves', async (_event) => {
	try {
		const savesDir = await getSavesDirectory()
		const entries = await fs.readdir(savesDir, { withFileTypes: true })
		const savesMap = new Map() // Map to track latest save per slot
		
		for (const entry of entries) {
			if (entry.isFile() && entry.name.endsWith('.json')) {
				try {
					// Extract slot number from filename (format: {slot}_{mcName}_{timestamp}.json)
					const nameMatch = entry.name.match(/^(\d+)_/)
					if (!nameMatch) {
						console.warn(`File doesn't match save pattern: ${entry.name}`)
						continue
					}
					
					const slot = parseInt(nameMatch[1])
					const filePath = join(savesDir, entry.name)
					const data = await fs.readFile(filePath, 'utf-8')
					const saveData = JSON.parse(data)
					
					// Ensure slot number in data matches filename
					saveData.slot = slot
					
					// Keep only the latest save for each slot (compare timestamps)
					if (!savesMap.has(slot) || saveData.timestamp > savesMap.get(slot).timestamp) {
						savesMap.set(slot, saveData)
						console.log(`✔ Loaded save from disk - slot: ${slot}, file: ${entry.name}`)
					}
				} catch (err) {
					console.warn(`Ошибка при чтении ${entry.name}:`, err)
				}
			}
		}
		
		// Convert map to array
		const saves = Array.from(savesMap.values()).sort((a, b) => a.slot - b.slot)
		console.log(`✔ Найдено ${saves.length} сохранений`)
		return { success: true, data: saves }
	} catch (error) {
		console.error('⛔ Ошибка при получении списка сохранений:', error)
		return { success: false, error: error.message }
	}
})

ipcMain.handle('delete-save', async (_event, slotNumber) => {
	try {
		const savesDir = await getSavesDirectory()
		const entries = await fs.readdir(savesDir, { withFileTypes: true })
		
		// Найти файл сохранения с нужным номером слота
		const saveFile = entries.find(entry => {
			const nameMatch = entry.name.match(/^(\d+)_/)
			return entry.isFile() && nameMatch && parseInt(nameMatch[1]) === slotNumber
		})
		
		if (!saveFile) {
			return { success: false, error: 'Сохранение не найдено' }
		}
		
		const filePath = join(savesDir, saveFile.name)
		await fs.unlink(filePath)
		
		console.log(`✔ Сохранение удалено: ${saveFile.name}`)
		return { success: true }
	} catch (error) {
		console.error('⛔ Ошибка при удалении:', error)
		return { success: false, error: error.message }
	}
})


async function getInitialSettings() {
	const file = join(app.getPath('userData'), 'settings.json')
	const text = await fs.readFile(file, 'utf-8')
	return JSON.parse(text)
}

async function createWindow() {
	const settings = await getInitialSettings()
	let width = 900, height = 670
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
			sandbox: false
		}
	})

	mainWindow.on('ready-to-show', () => {
		mainWindow.show()
		// Открывать DevTools только в dev-режиме
		if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
			mainWindow.webContents.openDevTools({ mode: 'detach' })
		}
	})

	mainWindow.webContents.setWindowOpenHandler(details => {
		shell.openExternal(details.url)
		return { action: 'deny' }
	})

	mainWindow.webContents.on('before-input-event', (event, input) => {
		if (
			(input.key === 'F12' && input.type === 'keyDown') ||
			(input.control && input.shift && input.key.toLowerCase() === 'i' && input.type === 'keyDown')
		) {
			mainWindow.webContents.openDevTools({ mode: 'detach' })
			event.preventDefault()
		}
		// Добавить поддержку F5 и Ctrl+R для dev-режима
		if (is.dev && (
			(input.key === 'F5' && input.type === 'keyDown') ||
			(input.control && input.key.toLowerCase() === 'r' && input.type === 'keyDown')
		)) {
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
	app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))
	createWindow()
	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow()
	})
})

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit()
})