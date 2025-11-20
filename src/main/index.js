// src/main/index.js

import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join, dirname } from 'path'
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

// IPC handler for saving location data
ipcMain.handle('save-location', async (_event, locationId, locationData) => {
	try {
		if (!locationId) {
			throw new Error('Location ID is required')
		}
		
		if (!locationData) {
			throw new Error('Location data is required')
		}
		
		// In development mode, save to src directory
		// In production mode, save to resources directory
		const locationPath = is.dev
			? join(__dirname, '../../src/renderer/public/data/locations', `${locationId}.json`)
			: join(process.resourcesPath, 'app', 'out', 'renderer', 'public', 'data', 'locations', `${locationId}.json`)
		
		// Ensure directory exists
		const dirPath = dirname(locationPath)
		try {
			await fs.access(dirPath)
		} catch {
			await fs.mkdir(dirPath, { recursive: true })
		}
		
		// Custom JSON formatting to keep coordinates compact
		const jsonStringifyCompact = (obj) => {
			// First, convert to standard JSON
			const json = JSON.stringify(obj, null, 2);
			
			// Manual approach to make coordinate arrays compact
			const lines = json.split('\n');
			const newLines = [];
			let i = 0;
			
			while (i < lines.length) {
				const line = lines[i];
				
				// Check if this line contains "cord": [
				if (line.trim() === '"cord": [') {
					// Next line should have the first coordinate
					if (i + 1 < lines.length) {
						const xLine = lines[i + 1];
						const x = xLine.trim().replace(/,$/, ''); // Remove trailing comma if present
						
						// Next line should have the second coordinate
						if (i + 2 < lines.length) {
							const yLine = lines[i + 2];
							const y = yLine.trim().replace(/,$/, ''); // Remove trailing comma if present
							
							// Next line should be the closing bracket
							if (i + 3 < lines.length && lines[i + 3].trim() === ']') {
								// Replace with compact format
								newLines.push(line.replace('"cord": [', '"cord": [' + x + ', ' + y + ']'));
								// Skip the next 3 lines
								i += 4;
								continue;
							}
						}
					}
				}
				
				// Check if this line contains "position": {
				if (line.trim() === '"position": {') {
					// Next line should be "cord": [
					if (i + 1 < lines.length && lines[i + 1].trim() === '"cord": [') {
						// Next line should have the first coordinate
						if (i + 2 < lines.length) {
							const xLine = lines[i + 2];
							const x = xLine.trim().replace(/,$/, ''); // Remove trailing comma if present
							
							// Next line should have the second coordinate
							if (i + 3 < lines.length) {
								const yLine = lines[i + 3];
								const y = yLine.trim().replace(/,$/, ''); // Remove trailing comma if present
								
								// Next line should be the closing bracket
								if (i + 4 < lines.length && lines[i + 4].trim() === ']') {
									// Next line should be the closing brace
									if (i + 5 < lines.length && lines[i + 5].trim() === '}') {
										// Get the indentation level of the "position": { line
										const positionIndent = line.match(/^(\s*)/)[1];
										// Replace with compact format using proper indentation
										newLines.push(line); // "position": {
										newLines.push(positionIndent + '  "cord": [' + x + ', ' + y + ']'); // Compact cord with proper indentation
										newLines.push(positionIndent + '}'); // Closing brace with proper indentation
										// Skip the next 5 lines
										i += 6;
										continue;
									}
								}
							}
						}
					}
				}
				
				newLines.push(line);
				i++;
			}
			
			return newLines.join('\n');
		};
		
		// Write the location data to file with custom formatting
		const jsonData = jsonStringifyCompact(locationData);
		await fs.writeFile(locationPath, jsonData, 'utf-8');
		
		return { success: true }
	} catch (error) {
		console.error('Error saving location:', error)
		return { success: false, error: error.message || error.toString() }
	}
})

// IPC handler for reading location data
ipcMain.handle('load-location', async (_event, locationId) => {
  try {
    if (!locationId) {
      throw new Error('Location ID is required')
    }
    
    // In development mode, read from src directory
    // In production mode, read from resources directory
    const locationPath = is.dev
      ? join(__dirname, '../../src/renderer/public/data/locations', `${locationId}.json`)
      : join(process.resourcesPath, 'app', 'out', 'renderer', 'public', 'data', 'locations', `${locationId}.json`)
    
    const data = await fs.readFile(locationPath, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    console.error(`Failed to load location data for ${locationId}:`, error)
    return null
  }
})

// IPC handler for listing available locations
ipcMain.handle('list-locations', async () => {
  try {
    // In development mode, read from src directory
    // In production mode, read from resources directory
    const locationsDir = is.dev
      ? join(__dirname, '../../src/renderer/public/data/locations')
      : join(process.resourcesPath, 'app', 'out', 'renderer', 'public', 'data', 'locations')
    
    const files = await fs.readdir(locationsDir)
    const locations = files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''))
    
    return locations
  } catch (error) {
    console.error('Failed to list locations:', error)
    return []
  }
})

// IPC handler for reading tile data
ipcMain.handle('load-tile-data', async (_event, fileName) => {
  try {
    // In development mode, read from src directory
    // In production mode, read from resources directory
    const tilePath = is.dev
      ? join(__dirname, '../../src/renderer/public/data/tiles', fileName)
      : join(process.resourcesPath, 'app', 'out', 'renderer', 'public', 'data', 'tiles', fileName)
    
    const data = await fs.readFile(tilePath, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    console.error(`Failed to load tile data from ${fileName}:`, error)
    return null
  }
})

// IPC handler for listing available tile files
ipcMain.handle('list-tile-files', async () => {
  try {
    // In development mode, read from src directory
    // In production mode, read from resources directory
    const tilesDir = is.dev
      ? join(__dirname, '../../src/renderer/public/data/tiles')
      : join(process.resourcesPath, 'app', 'out', 'renderer', 'public', 'data', 'tiles')
    
    const files = await fs.readdir(tilesDir)
    return files.filter(file => file.endsWith('.json'))
  } catch (error) {
    console.error('Failed to list tile files:', error)
    return []
  }
})

// IPC handler for reading character data
ipcMain.handle('load-character', async (_event, characterId) => {
  try {
    if (!characterId) {
      throw new Error('Character ID is required')
    }
    
    // In development mode, read from src directory
    // In production mode, read from resources directory
    const characterPath = is.dev
      ? join(__dirname, '../../src/renderer/public/data/characters', `${characterId}.json`)
      : join(process.resourcesPath, 'app', 'out', 'renderer', 'public', 'data', 'characters', `${characterId}.json`)
    
    const data = await fs.readFile(characterPath, 'utf-8')
    const jsonData = JSON.parse(data)
    // Extract the character data (the JSON has the character ID as the key)
    return jsonData[characterId] || jsonData
  } catch (error) {
    console.error(`Failed to load character data for ${characterId}:`, error)
    return null
  }
})

// IPC handler for listing available characters
ipcMain.handle('list-characters', async () => {
  try {
    // In development mode, read from src directory
    // In production mode, read from resources directory
    const charactersDir = is.dev
      ? join(__dirname, '../../src/renderer/public/data/characters')
      : join(process.resourcesPath, 'app', 'out', 'renderer', 'public', 'data', 'characters')
    
    const files = await fs.readdir(charactersDir)
    const characters = files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''))
    
    return characters
  } catch (error) {
    console.error('Failed to list characters:', error)
    return []
  }
})

// IPC handler for saving game data
ipcMain.handle('save-game', async (_event, gameData) => {
	try {
		const userDataPath = app.getPath('userData')
		const savesDir = join(userDataPath, 'saves')
		
		// Find the next available save slot
		let saveSlot = 0
		let saveDir = join(savesDir, String(saveSlot))
		while (true) {
			try {
				await fs.access(saveDir)
				saveSlot++
				saveDir = join(savesDir, String(saveSlot))
			} catch {
				// Directory doesn't exist, use this slot
				break
			}
		}
		
		// Create the save directory
		await fs.mkdir(saveDir, { recursive: true })
		
		// Create the autosave.json file with game data
		const autosavePath = join(saveDir, 'autosave.json')
		await fs.writeFile(autosavePath, JSON.stringify(gameData, null, 2), 'utf-8')
		
		return { success: true, saveSlot }
	} catch (error) {
		console.error('Error saving game:', error)
		return { success: false, error: error.message }
	}
})

// IPC handler for loading save data
ipcMain.handle('load-saves', async () => {
	try {
		const userDataPath = app.getPath('userData')
		const savesDir = join(userDataPath, 'saves')
		
		// Check if saves directory exists
		try {
			await fs.access(savesDir)
		} catch {
			// No saves directory, return empty array
			return []
		}
		
		// Read all directories in saves folder
		const saveSlots = await fs.readdir(savesDir, { withFileTypes: true })
		const saves = []
		
		// Process each save slot directory
		for (const entry of saveSlots) {
			if (entry.isDirectory()) {
				const saveSlotDir = join(savesDir, entry.name)
				const autosavePath = join(saveSlotDir, 'autosave.json')
				
				try {
					// Check if autosave.json exists
					await fs.access(autosavePath)
					
					// Read autosave.json
					const autosaveData = await fs.readFile(autosavePath, 'utf-8')
					const autosave = JSON.parse(autosaveData)
					
					// Get all save files in this directory (including autosave.json now)
					const saveFiles = await fs.readdir(saveSlotDir, { withFileTypes: true })
					const saveFileList = []
					
					for (const file of saveFiles) {
						if (file.isFile() && file.name.endsWith('.json')) {
							const fileName = file.name === 'autosave.json' 
								? 'Auto Save' 
								: file.name.replace('.json', '')
							const filePath = join(saveSlotDir, file.name)
							const stats = await fs.stat(filePath)
							
							saveFileList.push({
								name: fileName,
								date: stats.mtime.toISOString(),
								size: stats.size
							})
						}
					}
					
					// Add save group to list
					saves.push({
						id: entry.name,
						slot: entry.name,
						name: autosave.mc?.name || `Save Slot ${entry.name}`,
						saveFiles: saveFileList
					})
				} catch (error) {
					console.error(`Error reading save slot ${entry.name}:`, error)
					// Continue with other save slots
				}
			}
		}
		
		return saves
	} catch (error) {
		console.error('Error loading saves:', error)
		return []
	}
})

// IPC handler for loading a specific save file
ipcMain.handle('load-save-file', async (_event, filePath) => {
	try {
		const userDataPath = app.getPath('userData')
		const fullPath = join(userDataPath, filePath)
		
		// Check if file exists
		await fs.access(fullPath)
		
		// Read the save file
		const saveData = await fs.readFile(fullPath, 'utf-8')
		const parsedData = JSON.parse(saveData)
		
		return parsedData
	} catch (error) {
		console.error('Error loading save file:', error)
		return null
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