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
| `useStoryCamera.js` | Управление оверсканом (bleed) сцен, кинематографическими движениями камеры (`nod`, `shake`, `cough`, `damage`, `rumble`) и виньеткой урона. |
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

В проект встроен отдельный линтер стилей:
```bash
npm run lint:styles
```
Он проверяет соответствие правилу 1 из `AGENTS.md` во всех `.vue` и `.css` файлах. Запускайте его при изменении стилей:
* Разрешены только единицы `em` (запрещены `px`, `rem`, `vw`, `vh`).
* Исключения: тонкие рамки (1px/2px), точечные градиенты (1px), брейкпоинты `@media`.

---

## 6. Базовые утилиты и обработчики шагов (Engine Utilities & Step Handlers)

В рамках оптимизации кодовой базы были выделены модульные утилиты и декомпозирован `processStep`:
* `src/renderer/constants/gameInitialState.js` — единый источник истины для начального состояния игры (`createInitialGlobalData`, `createInitialCharacterData`).
* `src/renderer/constants/maps.js` — карта идентификаторов локаций и названий (`MAP_NAMES`, `getMapTitle`).
* `src/renderer/utils/equipment.js` — единый алгоритм сопоставления слотов экипировки и ассетов (`calculateEquipmentBySlot`).
* `src/renderer/utils/eventBus.js` — типизированная шина событий с дублированием в `window.dispatchEvent` для обратной совместимости.
* `src/renderer/utils/logger.js` — условный логгер (`import.meta.env.DEV`), предотвращающий спам в консоль в продакшене.
* **Модульные обработчики шагов в `useVisualNovel.js`**: `handleAudioStep`, `handleInventoryRemoveStep`, `handleInventoryModifyStep`, `handleInventoryAddStep`, `handleInventoryResetStep`, `handleQuestStep`, `handleMapStep`, `handleDiscoverLocationStep`, `handleNpcStep`.
* **Пакетное выполнение экшенов**:
  * `variables` (`operations: [...]`): последовательное синхронное применение массива выражений в рамках одного шага таймлайна/ноды.
  * `batch` (`actions: [...]`): универсальный пакет мгновенных действий через `executeInstantAction`, позволяющий группировать звук, выдачу предметов, модификацию переменных и открытие локаций без лишних шагов и задержек.

---

## 7. Централизованная конфигурация сцен и уровень пола (`sceneConfig.js`)

По аналогии с `hexConfig.js` для гексагональных карт, параметры отображения сцен, уровень пола и отступы холста вынесены в централизованный файл конфигурации:
[`src/renderer/utils/scene/sceneConfig.js`](file:///d:/projects/underlord-vue/src/renderer/utils/scene/sceneConfig.js).

### Ключевые параметры:
* **`DEFAULT_SCENE_FLOOR_OFFSET_EM` (по умолчанию `3.5em`)**:
  Дефолтная высота подъема линии пола (уровня пяток персонажа) над нижним краем экрана. Предотвращает визуальное упирание обуви в нижнюю рамку монитора и гармонирует с плашкой диалогов.
* **`PRESERVE_CANONICAL_RULER_HEIGHT` (по умолчанию `true`)**:
  Флаг сохранения канонического роста персонажа (175 см / `size`). При подъеме пяток кукла не сжимается по высоте, а аккуратно поднимается над полом, сохраняя естественные пропорции.
* **`resolveSceneBleed(...)` и `resolveSceneFloorOffsetPx(...)`**:
  Функции вычисления итогового смещения в пикселях с поддержкой любых единиц (`'3.5em'`, `'5%'`, `56`, `'60px'`).
* **Иерархия переопределения уровня пола**:
  1. `step.floorOffset` / `step.position.floorOffset` (в сценарии `intro.json`).
  2. `scene.floorOffset` / `scene.floorLevel` (в базе сцен `scenes.json`).
  3. Глобальный `DEFAULT_SCENE_FLOOR_OFFSET_EM` из `sceneConfig.js`.

---

## 8. Оркестратор игровых фаз и FSM (`useGameOrchestrator.js` & `gamePhases.js`)

Главный компонент `Game.vue` декомпозирован из «God Component» (1420 строк) в лаконичный декларативный шаблон (~320 строк). Вся координация режимов, сценариев и переходов передана конечному автомату (FSM) в [`useGameOrchestrator.js`](file:///c:/Users/DarkiFox/projects/underlord-vue/src/renderer/composables/useGameOrchestrator.js):

### 1. Фазы жизненного цикла (`src/renderer/constants/gamePhases.js`)
* `STORY_VN` — основной режим визуальной новеллы (диалоги, выборы, хотспоты).
* `OVERWORLD_HEX` — режим глобальной тактической 2.5D карты.
* `ISOMETRIC_EXPLORATION` — исследование изометрических локаций в реальном времени.
* `TURN_COMBAT` — тактические пошаговые битвы.
* `VR_HUB`, `VR_INTRO`, `VR_AUTH`, `VR_CHAR_CREATE`, `VR_SHUTDOWN` — пролог и виртуальная реальность.

### 2. Обязанности оркестратора:
* **FSM-переходы**: `transitionTo(nextPhase, payload)` с логированием и проверками.
* **Изометрия и боёвка**: управление оверлеями, передача исхода боя в ветвления новеллы (`${encounterId}_win`/`${encounterId}_lose`) и победа над мобами на изометрических картах.
* **VR & YGGDRASIL Flow**: управление нейрошлемом, запуск MMO, авторизация, создание персонажа, отключение серверов и переход в Новый Мир.
* **Сохранения и снимки**: вызовы `saveWithHiddenOverlays`, быстрые сохранения/загрузки, диалоги подтверждения.
* **Ren'Py Skip & UI Hide**: сокрытие интерфейса по `H` / клику, перемотка по `Ctrl`, приоритет `Escape` стека модальных окон.

---

## 9. Кинематографическая камера новеллы и оверскан (`useStoryCamera.js` & `camera-effects.css`)

Для создания кинематографического эффекта погружения (кивание в знак согласия, отрицательное покачивание головой, спазм кашля/чиха, тряска при получении урона) сцена новеллы снабжена системой оверскана и анимаций камеры:

### 1. Предотвращение черных полос (Overscan Bleed Margin)
* Параметр `DEFAULT_SCENE_CAMERA_OVERSCAN` (`1.05`) в `sceneConfig.js` масштабирует внутреннюю сцену (`.vn-camera-stage`) на 5% шире и выше экрана (по ~48px по бокам и ~27px сверху/снизу при 1920×1080).
* Контейнер `.vn-camera-viewport` удерживает размер экрана 100% и обрезает выступающие края (`overflow: hidden`).
* При смещениях и покачиваниях камеры (до `1.5em`) границы фонового арта не оголяют черную подложку холста.

### 2. Поддерживаемые пресеты анимаций камеры:
* **`nod`** (кивание согласия): наклон вниз на `1.3em` с пружинящим возвратом (`~0.6s`).
* **`shake`** (покачивание / отказ): горизонтальное покачивание из стороны в сторону (`~0.55s`).
* **`cough`** (кашель / чих): резкий спазм с глубоким наклоном на `1.6em` и затухающей отдачей (`~0.6s`).
* **`damage`** (урон / толчок): резкая хаотичная тряска с одновременной вспышкой красной виньетки (`.vn-camera-damage-overlay`) (`~0.65s`).
* **`rumble`** (грохот / вибрация): тяжелая вибрация от шагов колоссов, взрывов или заводских машин (`~0.8s`).
* **`reset`**: мгновенный возврат камеры в нейтральное состояние.

### 3. Синтаксис шага в сценарии:
```json
{
  "type": "camera",
  "effect": "cough",
  "duration": 0.6,
  "wait": false
}
```
* Если `wait: false` (по умолчанию), камера анимируется параллельно с диалогом или озвучкой.
* Если `wait: true`, сценарий делает паузу до окончания движения камеры.
* Экшен также доступен внутри пакетов `batch`:
```json
{
  "type": "batch",
  "actions": [
    { "type": "camera", "effect": "damage" },
    { "type": "sound", "file": "audio/sound/hit.mp3" }
  ]
}
```
* Доступны готовые макросы: `macros/camera_nod`, `macros/camera_refuse`, `macros/cough`, `macros/camera_damage`.

