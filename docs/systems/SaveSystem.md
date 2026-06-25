# Система сохранений (Save/Load System)

В приложении реализована система сохранений в стиле визуальных новелл (Ren'Py).

## Хранение данных
- **Папка сохранений**: `%APPDATA%/underlord-vue/saves/` (Windows)
- **Формат файла**: JSON
- **Имя файла**: `{slotNumber}_{mcName}_{timestamp}.json` (например, `0_John_2026-01-30_143022.json`)
- **Количество слотов**: 20 слотов (от 0 до 19)

## Архитектура системы

Система разделена на несколько уровней:

1. **Main Process (Electron)** (`src/main/index.js`)
   - IPC обработчики: `save-game`, `load-game`, `list-saves`, `delete-save`. Выполняют операции чтения/записи файлов на диске.

2. **Pinia Store** (`src/renderer/stores/saves.js`)
   - Управляет метаданными сохранений, состоянием и связью с Main процессом через IPC.
   - Сериализует и десериализует стейт игры.

3. **Компоненты Vue**
   - Все компоненты для работы с сохранениями лежат в `src/renderer/components/saves/`.
   - `SavesContent.vue` — Главный интерфейс со вкладками Load/Save.
   - `SavesGrid.vue` — Сетка слотов сохранений с пагинацией.
   - `VisualNovel.vue` содержит методы `getGameState()` и `restoreGameState(saveData)`.

## Что сохраняется

Структура сохраняемого `gameState`:

```javascript
{
  storyData: {},           // Текущий JSON истории
  stepIndex: 0,            // Индекс текущего шага
  callStack: [],           // Стек вызовов для вложенных историй
  globalData: {},          // Глобальные переменные (например, инвентарь, флаги)
  characterData: {},       // Данные всех персонажей (статы, экипировка)
  visibleCharacters: [],   // Массив ID отображаемых персонажей
  currentScene: null       // ID текущей сцены (фона)
}
```

## Для разработчиков

### Использование Store
```javascript
import { useSavesStore } from '@/stores/saves'
const savesStore = useSavesStore()

// Сохранение
const gameState = visualNovel.value.getGameState()
await savesStore.saveGame(slotNumber, gameState, "ИмяИгрока")

// Загрузка
const result = await savesStore.loadGame(slotNumber)
if (result.success) {
  await visualNovel.value.restoreGameState(result.data.gameState)
}

// Список
const list = await savesStore.listSaves()
```

### Service Layer API

Сохранение реализовано слоистой архитектурой для тестируемости и переиспользования:

**`saveService`** (`src/renderer/services/saveService.js`) — низкоуровневый модуль для работы с файлами и IPC:

#### Экспортируемые функции:
- **`createSaveFile(slotNumber, gameState, mcName, characterDefaults)`**  
  Формирует объект `saveFile`, минимизируя данные (вычисляет дельту `characterData`).
  
- **`saveService.saveGame(slotNumber, saveFile)`**  
  Вызывает `window.api.saveGame`, возвращает `{ success, data?, error? }`
  
- **`saveService.loadGame(slotNumber)`**  
  Загружает сохранение по номеру слота.
  
- **`saveService.deleteSave(slotNumber)`**  
  Удаляет сохранение.
  
- **`saveService.listSaves()`**  
  Возвращает список всех сохранений.

#### Пример использования в сторе:
```javascript
import { saveService, createSaveFile } from '@/services/saveService'

const saveGame = async (slot, gameState, mcName, characterDefaults) => {
  const saveFile = createSaveFile(slot, gameState, mcName, characterDefaults)
  const result = await saveService.saveGame(slot, saveFile)
  if (result.success) {
    // обновляем локальное состояние стора
  }
}
```

**Примечание**: `saveService` не знает о Pinia; он возвращает чистые результаты IPC. Store отвечает за управление состоянием приложения.

#### Тестирование:
- `createSaveFile` и `findNonSerializable` легко тестируемы и должны иметь unit-тесты для проверки сериализации, корректной дельты `characterData` и обработки несериализуемых полей.

