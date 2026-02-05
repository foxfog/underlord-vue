saveService — краткая документация

Цель: вынести сериализацию и IPC для операций сохранений в отдельный модуль, чтобы стор и компоненты оставались тонкими и тестируемыми.

Экспортируемые функции/объекты:
- `createSaveFile(slotNumber, gameState, mcName, characterDefaults)` — формирует объект saveFile, минимизируя данные (дельта characterData)
- `saveService.saveGame(slotNumber, saveFile)` — вызывает `window.api.saveGame`, возвращает `{ success, data? , error? }`
- `saveService.loadGame(slotNumber)` — вызывает `window.api.loadGame`
- `saveService.deleteSave(slotNumber)` — вызывает `window.api.deleteSave`
- `saveService.listSaves()` — вызывает `window.api.listSaves`

Тестирование:
- `createSaveFile` и `findNonSerializable` легко тестируемы и должны иметь unit-тесты, которые проверяют: сериализацию, корректную дельту characterData и обработку ошибок при несерилизуемых полях.

Пример использования в сторе:
- `const saveFile = createSaveFile(slot, gameState, mcName, characterDefaults)`
- `const result = await saveService.saveGame(slot, saveFile)`

Примечание: `saveService` не должен знать о Pinia; он возвращает чистые результаты IPC.

Пример: делегирование в Pinia store

```js
// store/saves.js
import { saveService, createSaveFile } from '../services/saveService'

const saveGame = async (slot, gameState, mcName, characterDefaults) => {
  const saveFile = createSaveFile(slot, gameState, mcName, characterDefaults)
  const result = await saveService.saveGame(slot, saveFile)
  if (result.success) {
    // update local store state
  }
}
```

