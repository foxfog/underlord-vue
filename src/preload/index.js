// src/preload/index.js

import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Создаём объект API
const api = {
	getSettings: (type) => ipcRenderer.invoke('get-settings', type), // type: undefined | 'default'
	closeWindow: () => ipcRenderer.send('close-window'), //закрыть окно
	setFullscreen: (flag) => ipcRenderer.send('set-fullscreen', flag),
	saveSettings: (data) => ipcRenderer.send('save-settings', data),
	listFiles: (folderPath) => ipcRenderer.invoke('list-files', folderPath),
	setResolution: (res) => ipcRenderer.send('set-resolution', res),
	saveGame: (mcName) => ipcRenderer.invoke('save-game', mcName),
	loadSaves: () => ipcRenderer.invoke('load-saves'),
	loadSaveFile: (filePath) => ipcRenderer.invoke('load-save-file', filePath),
	...electronAPI
}

if (process.contextIsolated) {
	try {
		contextBridge.exposeInMainWorld('electron', electronAPI)
		contextBridge.exposeInMainWorld('electronAPI', api)
		contextBridge.exposeInMainWorld('api', api)
	} catch (error) {
		console.error('Preload bridge error:', error)
	}
} else {
	window.electron = electronAPI
	window.electronAPI = api
	window.api = api
}