// Test parser with .scene file
import { SceneParser } from './src/renderer/utils/sceneParser.js'
import fs from 'fs'

// Load the scene file
const sceneContent = fs.readFileSync('./src/renderer/public/data/scenes/ru/start.scene', 'utf-8')

const parser = new SceneParser()
const result = parser.parse(sceneContent)

console.log('=== PARSED SCENE ===')
console.log('Labels:', result.labels)
console.log('\nCommands:')
result.commands.forEach((cmd, idx) => {
	console.log(`${idx}: ${cmd.type}`, cmd)
})

console.log('\n=== JUMPING TO START ===')
// Simulate jumpToLabel logic
const labelLineNum = result.labels['start']
const startIndex = result.commands.findIndex(cmd => cmd.lineNum > labelLineNum)
console.log('Label line:', labelLineNum)
console.log('Start command index:', startIndex)
console.log('Start command:', result.commands[startIndex])
