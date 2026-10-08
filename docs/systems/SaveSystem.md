# Система сохранений (Save/Load System)

В игре реализована профильная система сохранений в стиле классических RPG (Skyrim / Fallout). Каждое прохождение и персонаж имеют собственный изолированный профиль, хранящийся в номерной подпапке.

## Хранение данных
- **Корневая папка сохранений**: `%APPDATA%/underlord/saves/` (Windows)
- **Номерные подпапки профилей**: `{profileNumber}_{sanitizedName}/` (например, `1_Momonga/`, `2_Ainz/`)
- **Метаданные профиля**: `profile.json` внутри папки профиля:
  ```json
  {
    "id": 1,
    "folder": "1_Momonga",
    "name": "Momonga",
    "createdAt": 1740000000000,
    "updatedAt": 1740000000000
  }
  ```
- **Формат файла сохранений**: JSON
- **Имя файла**: `{slotNumber}_{mcName}_{timestamp}.json` (например, `0_Momonga_2026-10-08_143022.json`)
- **Количество слотов на профиль**:
  - **Слот 0**: Автосохранение (Autosave). Создаётся автоматически после подтверждения имени персонажа и входа в мир.
  - **Слоты 1..8**: Быстрые сохранения (Quick saves). Ротируются при быстром сохранении, не затирая автосохранение.
  - **Слоты 9..98**: 90 слотов для ручных сохранений (1..90 на страницах 1..10).

## Архитектура системы

Система разделена на несколько уровней:

1. **Main Process (Electron)** (`src/main/index.js`)
   - IPC обработчики профилей:
     - `list-profiles` — сканирует папки профилей, собирает количество сохранений, последнее время активности и скриншот;
     - `create-profile` — определяет следующий номер `maxNum + 1`, создаёт подпапку `{id}_{safeName}` и файл `profile.json`;
     - `delete-profile` — удаляет подпапку профиля и все его сохранения.
   - IPC обработчики сохранений:
     - `save-game` (слот, saveFile, clipRect, profileFolder) — сохраняет JSON и скриншот в подпапку профиля;
     - `load-game` (слот, profileFolder) — загружает сохранение из подпапки профиля (с fallback поиском);
     - `list-saves` (profileFolder) — возвращает сохранения для профиля или всех профилей;
     - `delete-save` (слот, profileFolder) — удаляет файл сохранения.

2. **Preload Bridge** (`src/preload/index.js`)
   - Проксирует IPC вызовы в renderer: `window.api.listProfiles`, `createProfile`, `deleteProfile`, `saveGame`, `loadGame`, `listSaves`, `deleteSave`.

3. **Service Layer** (`src/renderer/services/saveService.js`)
   - Чистые функции сериализации `serializeGameState`, `createSaveFile` (с полями `saveType`, `profileFolder`, `profileId`).
   - Межпроцессные вызовы `saveService.*` с защитой от запуска вне Electron (browser fallback).

4. **Pinia Store** (`src/renderer/stores/saves.js`)
   - Реактивное состояние:
     - `profiles` — список доступных профилей;
     - `currentProfile` — активный профиль текущей игровой сессии;
     - `selectedProfileFolder` — выбранный профиль в UI ('all' или имя папки);
     - `saves` — мапа сохранений;
     - `quickSaves`, `autoSave`, `allSaves`, `allSavesList`.
   - Методы `createProfile`, `deleteProfile`, `selectProfile`, `saveAuto`, `saveQuick`, `saveGame`, `loadGame`, `deleteSave`.

5. **Компоненты Vue** (`src/renderer/components/saves/`)
   - `SavesGrid.vue`:
     - Шапка выбора персонажа / профиля (Skyrim style): переключение между персонажами или просмотр всех сохранений.
     - Кнопка удаления профиля со всеми сохранениями.
     - Вкладка «Б»: Слот 0 с бейджем `⚡ АВТО` и слоты 1..8 `Б1..Б8`.
     - Вкладки 1..10 для ручных слотов 1..90.
   - `SavesContent.vue` — Вкладки Сохранить / Загрузить.

6. **Оркестратор игры** (`src/renderer/composables/useGameOrchestrator.js`)
   - `onCharCreationConfirmed({ nickname })` — после подтверждения никнейма в Yggdrasil вызывает `savesStore.createProfile(nickname)`.
   - `onShutdownSequenceComplete()` — после перехода в Деревню Карн (`intro_carne_arrival`) автоматически делает первый автосейв созданного профиля: `savesStore.saveAuto(...)`.
   - При старте новой игры сбрасывает `savesStore.currentProfile = null`.
   - При загрузке сохранения восстанавливает `savesStore.currentProfile` из метаданных сейва.

## Что сохраняется

Структура сохраняемого `gameState`:

```javascript
{
  storyData: {},           // Текущий JSON истории
  stepIndex: 0,            // Индекс текущего шага
  callStack: [],           // Стек вызовов для вложенных историй
  globalData: {},          // Глобальные переменные (календарь, квесты, энциклопедии)
  characterDataDelta: {},  // Дельта данных персонажей относительно дефолтов
  visibleCharacters: [],   // Отображаемые персонажи
  currentScene: null,      // ID текущей сцены
  currentSceneMods: [],    // Модификаторы сцены
  audioStreams: {},        // Активные зацикленные аудиопотоки
  uiVisibility: {}         // Видимость элементов интерфейса
}
```
