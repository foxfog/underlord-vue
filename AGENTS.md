# Руководство для ИИ-агентов (AI Agent Guidelines)

Данный документ содержит обязательные правила, соглашения и архитектурные стандарты для ИИ-агентов, работающих с кодовой базой **Underlord-Vue**.

---

## 1. Главное правило адаптивной верстки: ТОЛЬКО `em` (НИКАКИХ `px` и `rem`!)

В проекте реализована глобальная система адаптивного масштабирования под экраны любых разрешений и пропорций на основе базового холста **1920×1080**.

Масштабирование управляется CSS-переменной `--size`, объявленной в `src/renderer/public/styles/base.css`:

```css
:root {
	--layout-width: 1920;
	--layout-height: 1080;

	--size-coef: calc(2 * 800 / 1920);
	--size-pred: min(
		calc(100dvw / var(--layout-width) * (var(--layout-width) / 100)),
		calc(100dvh / var(--layout-height) * (var(--layout-width) / 100))
	);
	--size: calc(var(--size-coef) * var(--size-pred));
}

body {
	font-size: calc(1 * var(--size));
}

#app {
	aspect-ratio: var(--layout-width) / var(--layout-height);
	font-size: 1em;
}
```

### 🚫 Строжайше запрещено:
1. **Никогда не используйте фиксированные значения в `px`**:
   * ❌ `width: 400px`, `height: 250px`, `min-width: 120px`
   * ❌ `padding: 16px 24px`, `margin: 10px`, `gap: 12px`
   * ❌ `font-size: 14px`, `letter-spacing: 2px`, `line-height: 20px`
   * ❌ `border-radius: 8px`, `border-radius: 16px`
   * ❌ `box-shadow: 0 4px 15px rgba(...)`, `text-shadow: 0 0 10px ...`
   * ❌ `backdrop-filter: blur(10px)`, `filter: blur(5px)`
   * ❌ `top: 20px`, `left: 30px`, `transform: translateY(-5px)`
2. **Никогда не используйте единицы `rem` (`font-size: 1rem; padding: 1rem;` и т.д.)**:
   * ❌ **Почему `rem` ломает верстку**: единица `rem` рассчитывается от корневого тега `html` (браузерные 16px), который **не** пересчитывается динамически переменной `--size`. В результате при изменении размера окна элементы с `rem` остаются жестко фиксированными и ломают пропорции интерфейса! Всегда заменяйте `rem` на `em`.
3. **Никогда не используйте `position: fixed` для полноэкранных игровых интерфейсов и сцен**:
   * ❌ **Почему `fixed` ломает пропорции игры**: `#app` центрируется и строго соблюдает игровое соотношение сторон (`aspect-ratio: 1920/1080`). Любой элемент с `position: fixed; inset: 0;` привязывается к физическому окну браузера/Electron, вылезая за границы игрового холста и растягиваясь на черные полосы леттербоксинга (на экранах 21:9, 16:10, 4:3).
   * ✅ **Как правильно**: Всегда используйте `position: absolute; inset: 0;` внутри `.game-area` / `#app`.
4. **Никогда не используйте единицы `vw` и `vh` внутри игрового интерфейса**:
   * ❌ Единицы `vw`/`vh` рассчитываются от окна браузера, а не от игрового холста `#app`. Используйте `em` (привязаны к масштабу через `--size`) или проценты `%` от родительского контейнера.

### ✅ Разрешенные исключения:
1. **Тонкие рамки (Hairline borders)**: `border: 1px solid ...`, `border: 2px solid ...`, `border-bottom: 1px solid ...`, `border-left: 2px dashed ...`.
2. **Точечные сетки/градиенты**: `radial-gradient(... 1px, transparent 0)`.
3. **Медиа-запросы брейкпоинтов**: `@media (max-width: 768px)`.
4. **Глобальные бэкдропы всплывающих диалоговых окон**: затемнение всего экрана под диалоговым окном (в `_modal.css`). При этом сам контент окна всегда задается в `em`.

### 📐 Как правильно задавать размеры:
* **Основная единица**: ТОЛЬКО `em` (не `rem`!). Поскольку корневой шрифт `#app` и `body` привязан к `var(--size)`, `1em` автоматически увеличивается и уменьшается при масштабировании окна или изменении разрешения.
* **Прямой расчет**: `calc(N * var(--size))` (например, для скроллбаров или кастомных индикаторов).
* **Проценты**: `%`, `clamp(...)`, `min(25em, 85%)`.
* **Полноэкранные игровые оверлеи и экраны сцен**:
  Все игровые сцены и оверлеи (интерфейс шлема, видео, экраны создания персонажа/входа, экраны завершения) должны позиционироваться внутри `.game-area` / `#app`:
  ```css
  .my-scene-overlay {
  	position: absolute;
  	inset: 0;
  	font-size: calc(1 * var(--size));
  }
  ```
* **CSS-транзишены и масштабирование**:
  При изменении размера окна или разрешения на `html` автоматически навешивается класс `.is-resizing`, отключающий все транзишены на время ресайза (`transition: none !important`), чтобы размеры элементов пересчитывались мгновенно без желеобразных задержек. В компонентах избегайте неизбирательного `transition: all 0.3s`, явно указывайте анимируемые свойства (например, `transition: color 0.2s, background-color 0.2s, opacity 0.2s, transform 0.2s`).

### Таблица соответствий для быстрой конвертации:
| Значение в px (при 16px базе) | Рекомендуемый эквивалент |
| :--- | :--- |
| `1px` – `2px` (для отступов/смещений) | `0.05em` – `0.12em` |
| `4px` | `0.25em` |
| `6px` – `8px` | `0.4em` – `0.5em` |
| `12px` | `0.75em` |
| `16px` | `1em` |
| `20px` – `24px` | `1.25em` – `1.5em` |
| `32px` | `2em` |
| `100px` | `6.25em` |
| `400px` | `25em` |

---

## 2. Архитектура проекта и документация (Architecture & Docs Index)

Подробная спецификация игровых механик и форматов данных вынесена в папку `docs/`. При работе с конкретной системой изучайте соответствующее руководство:

* **Карты и открытие локаций (Map & Marker Discovery)**:
  Двухуровневая система (`worldMap` / `localMap`), переключение по `L`, автопривязка сцен в `scenes.json`, открытие точек (`discoveredLocations`, экшен `discover-location`).
  📖 Документация: [`docs/systems/MapSystem.md`](docs/systems/MapSystem.md)
* **Интерактивные маркеры сцен (Scene Hotspots)**:
  Интерьерные переходы между комнатами без карты, статусы `active`/`locked`/`hidden`, реакция `lockedAction` (звук, текст, уведомление), дельта-сохранения в `globalData.sceneHotspots`.
  📖 Документация: [`docs/systems/SceneHotspots.md`](docs/systems/SceneHotspots.md)
* **Время и календарь (Time & Calendar)**:
  Два мира (Земля 2138 с 24ч часами vs Новый Мир с 360-дневным календарем), 4 фазы суток, перемотка `advanceTime()`.
  📖 Документация: [`docs/systems/TimeCalendar.md`](docs/systems/TimeCalendar.md)
* **Сценарные действия и управление UI (UI & Scene Actions)**:
  Плавные затемнения (`fade`, дефолтные переходы между сценами `sceneTransitions`), очистка персонажей со сцены (`clearCharacters`), контроль кнопок (`type: "ui"`), синхронизация экипировки персонажа со сценой (`syncCharacterEquipment`), горячие клавиши Ren'Py-style (`H` для скрытия UI, удержание `Ctrl` для быстрой перемотки текста со стилизованным индикатором).
  📖 Документация: [`docs/ui/UIControl.md`](docs/ui/UIControl.md)
* **Диалоговая система (Dialogue System)**:
  Многошаговые диалоги, эффект пишущей машинки, автоскрытие UI при репликах (`DIALOGUE_HIDE_UI_CONFIG`).
  📖 Документация: [`docs/ui/DialogueSystem.md`](docs/ui/DialogueSystem.md)
* **Персонажи и спрайты (Characters & Sprites)**:
  Структура `body.json`, характеристики `values.json`, слоты экипировки `equipment.json`.
  📖 Документация: [`docs/characters/BodyStructure.md`](docs/characters/BodyStructure.md), [`docs/characters/Animation.md`](docs/characters/Animation.md)
* **Квесты и журнал (Quests System)**:
  Древовидная иерархия (`parentId`), задачи (`tasks`), сюжетные заметки (`storyEntries`). Композабл `useQuests.js`.
* **Инвентарь и экипировка (Inventory & Equipment)**:
  Слоты снаряжения, части спрайтов тела, контекстное меню предметов.
  📖 Документация: [`docs/systems/Inventory.md`](docs/systems/Inventory.md), [`docs/systems/EquipmentSystem.md`](docs/systems/EquipmentSystem.md)
* **Энциклопедия и журнал персонажей (Encyclopedia & Characters)**:
  Карточки персонажей, модульные блочные заметки (`{ id, title, text }`), дерево категорий и подкатегорий, динамические уведомления об изменении отношений (`*_symp`). Композабл `useEncyclopedia.js`.
  📖 Документация: [`docs/systems/EncyclopediaSystem.md`](docs/systems/EncyclopediaSystem.md)
* **Распорядок дня и присутствие NPC (NPC Schedule & Presence)**:
  Многоуровневая система размещения NPC (Skyrim-style), распорядки дня по времени суток и сезону, приоритет сюжетных экшенов (`override`), дельта-сохранения в `globalData.npcStates`, отображение местоположения в карточках Журнала. Композабл `useNpcSchedule.js`.
  📖 Документация: [`docs/systems/NPCScheduleSystem.md`](docs/systems/NPCScheduleSystem.md)
* **Система сохранений (Save & Load)**:
  Сериализация `gameState` (`globalData`, `characterData`, `discoveredLocations`), IPC с Main процессом.
  📖 Документация: [`docs/systems/SaveSystem.md`](docs/systems/SaveSystem.md)
* **Архитектура новеллы и стейт-менеджмент (Story Architecture)**:
  Декомпозиция `useVisualNovel.js` на модули `useStory*` (`composables/story/`), хранилища `gameStore.js` (устранение prop-drilling), `modalStore.js` (модальные окна) и сервис `saveManager.js`.
  📖 Документация: [`docs/systems/StoryArchitecture.md`](docs/systems/StoryArchitecture.md)
* **Изометрические локации и тактическая система (Isometric 2.5D System)**:
  Ромбовидная 2:1 сетка (64×32), многоуровневый рельеф с дискретными высотами $Z$, пошаговое перемещение ГГ (A* pathfinding с ограничением перепада высот), интерактивные объекты (прополка сорняков), раздел «Тесты» в Главном меню, редактор карт с масштабированием по 4 сторонам и якорям 3×3, гибридный RLE-формат карт (`terrain` + `overrides` + `prefabs` с экономией размера до 98%), интеграция со сценами и картами.
  📖 Документация: [`docs/systems/IsometricSystem.md`](docs/systems/IsometricSystem.md)
* **Аудиосистема**:
  Расчет громкости любых звуков строго через `commonVolume` и категорию (`commonVolume * musicVolume / 10000`).
* **Модальные окна**:
  Все окна регистрируются в `useModalStack.js` (закрытие верхнего окна по `ESC`).

---

## 3. Контроль качества перед сдачей работы

Перед завершением задачи агент выполняет проверку:
1. Запустить юнит-тесты:
   ```bash
   npm test
   ```
   Все тесты Vitest должны завершаться со статусом `PASS`.
2. **Обязательная актуализация документации и руководств**:
   * При внедрении новых систем, сценарных экшенов, механик или изменении форматов данных агент **обязан** создать или обновить подробный гайд в папке `docs/` (`docs/systems/`, `docs/ui/`, `docs/characters/`).
   * Если добавлен новый документ, зарегистрировать его в оглавлении `docs/README.md` и добавить краткую ссылку в раздел 2 данного `AGENTS.md`.
   * Если появились новые архитектурные ограничения, табу или прямые указания для работы ИИ — зафиксировать их прямо в `AGENTS.md`.
