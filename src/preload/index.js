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
	// Save/Load game
	saveGame: (slotNumber, saveFile, clipRect) =>
		ipcRenderer.invoke('save-game', slotNumber, saveFile, clipRect),
	loadGame: (slotNumber) => ipcRenderer.invoke('load-game', slotNumber),
	listSaves: () => ipcRenderer.invoke('list-saves'),
	deleteSave: (slotNumber) => ipcRenderer.invoke('delete-save', slotNumber),
	// Data Editor IPC
	dataEditor: {
		getInfo: () => ipcRenderer.invoke('data-editor-get-info'),
		readFile: (relPath) => ipcRenderer.invoke('data-editor-read-file', relPath),
		writeFile: (relPath, data) => ipcRenderer.invoke('data-editor-write-file', relPath, data),
		deleteFile: (relPath) => ipcRenderer.invoke('data-editor-delete-file', relPath),
		listFiles: (relDir) => ipcRenderer.invoke('data-editor-list-files', relDir),
		copyLocale: (params) => ipcRenderer.invoke('data-editor-copy-locale', params),
		listLocales: () => ipcRenderer.invoke('data-editor-list-locales'),
		deleteLocale: (lang) => ipcRenderer.invoke('data-editor-delete-locale', lang)
	}
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
