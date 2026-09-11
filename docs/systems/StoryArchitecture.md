# Архитектура движка визуальной новеллы и стейт-менеджмент (Story Architecture)

В ходе масштабного рефакторинга монолитный композабл `useVisualNovel.js` (~3700 строк) был разделен на узкоспециализированные композаблы, сервисы и Pinia хранилища. Это снизило связность кода, предотвратило prop-drilling и упростило тестирование.

---

## 1. Декомпозиция модулей визуальной новеллы (`composables/story/`)

Каждый аспект новеллы вынесен в отдельный композабл:

| Модуль | Обязанности |
| :--- | :--- |
| `useStoryAudio.js` | Управление аудио-потоками (`bgm`, `sfx`, `voice`, `ambient`), отложенными воспроизведениями и вычислением громкости строго по формуле `(commonVolume * catVolume) / 10000`. |
| `useStoryUI.js` | Видимость элементов интерфейса (`uiVisibility`, `isUIHidden`, горячая клавиша `H`, автоскрытие при диалогах `DIALOGUE_HIDE_UI_CONFIG`). |
| `useStoryHistory.js` | Ведение журнала диалогов (`history`, `addToHistory`, `clearHistory`). |
| `useStoryDialogue.js` | Текст реплик, эффект пишущей машинки, многошаговые диалоги (`multiStepDialogue`), варианты выбора и автопропуск (`Ctrl` fast-forward). |
| `useSceneHotspots.js` | Интерактивные точки сцены (`sceneHotspots`), вычисление доступности, реакция на заблокированные маркеры (`lockedAction`). |
| `useStoryCharacters.js` | Размещение и анимация спрайтов персонажей на сцене, синхронизация экипировки персонажей со слотами. |
| `useStoryTransitions.js` | Затемнения (`fadeOverlay`, `handleFadeStep`) и сценарные переходы между локациями/сценами. |
| `useStoryVariables.js` | Вычисление условий (`evaluateCondition`), интерполяция переменных (`substituteVariables`), модификация глобальных переменных и статов персонажа. |

---

## 2. Глобальное состояние игры (`stores/gameStore.js`)

Хранилище Pinia `useGameStore` устраняет необходимость «пробрасывать» пропсы через `Game.vue`:
* `globalData` — глобальные флаги, календарь, сюжетные триггеры, состояние хотспотов.
* `characterData` — характеристики, инвентарь и экипировка главного героя.
* `sceneData` — данные текущей сцены.

Компоненты интерфейса (`Topbar.vue`, `MapModal.vue`, `InventoryModal.vue`, `CalendarModal.vue`, `JournalModal.vue`) теперь реактивно связываются напрямую со стором:
```javascript
import { useGameStore } from '@/stores/gameStore'

const gameStore = useGameStore()
// gameStore.globalData, gameStore.characterData
```

---

## 3. Централизованное управление модальными окнами (`stores/modalStore.js`)

Хранилище `useModalStore` централизует состояние всех модальных окон игры:
* Окна: `map`, `inventory`, `journal`, `calendar`, `history`, `save`, `load`, `settings`.
* Предоставляет методы `open(modalName)`, `close(modalName)`, `toggle(modalName)`, `closeAll()`.
* Полная интеграция со стеком модальных окон `useModalStack.js` (закрытие по `Escape`).

---

## 4. Сериализация и десериализация сохранений (`services/saveManager.js`)

Логика сохранения и загрузки вынесена в чистый сервис:
* `serializeGameStateSnapshot(...)` — создание снимка текущего состояния игры (включая переменные, состояние UI, персонажей, хотспотов, истории и открытых локаций).
* `applyRestoredState(...)` — применение снимка из сохранения с защитой от рассинхронизации версий.

---

## 5. Контроль адаптивности стилей (`scripts/lint-styles.js`)

В проект встроен автоматический линтер стилей:
```bash
npm run lint:styles
```
Он проверяет соответствие правилу 1 из `AGENTS.md` во всех `.vue` и `.css` файлах:
* Разрешены только единицы `em` (запрещены `px`, `rem`, `vw`, `vh`).
* Исключения: тонкие рамки (1px/2px), точечные градиенты (1px), брейкпоинты `@media`.
* Проверка также автоматически запускается в Vitest (`src/renderer/__tests__/styleQualityAgentsRule.test.js`).

---

## 6. Базовые утилиты и обработчики шагов (Engine Utilities & Step Handlers)

В рамках оптимизации кодовой базы были выделены модульные утилиты и декомпозирован `processStep`:
* `src/renderer/constants/gameInitialState.js` — единый источник истины для начального состояния игры (`createInitialGlobalData`, `createInitialCharacterData`).
* `src/renderer/constants/maps.js` — карта идентификаторов локаций и названий (`MAP_NAMES`, `getMapTitle`).
* `src/renderer/utils/equipment.js` — единый алгоритм сопоставления слотов экипировки и ассетов (`calculateEquipmentBySlot`).
* `src/renderer/utils/eventBus.js` — типизированная шина событий с дублированием в `window.dispatchEvent` для обратной совместимости.
* `src/renderer/utils/logger.js` — условный логгер (`import.meta.env.DEV`), предотвращающий спам в консоль в продакшене.
* **Модульные обработчики шагов в `useVisualNovel.js`**: `handleAudioStep`, `handleInventoryRemoveStep`, `handleInventoryModifyStep`, `handleInventoryAddStep`, `handleInventoryResetStep`, `handleQuestStep`, `handleMapStep`, `handleDiscoverLocationStep`, `handleNpcStep`.
