# Руководство для ИИ-агентов (AI Agent Guidelines)

Обязательные правила, архитектурные стандарты и индекс систем для кодовой базы **Underlord-Vue**.

---

## 1. Главное правило верстки: ТОЛЬКО `em` (НИКАКИХ `px` и `rem`!)

Интерфейс масштабируется под базовый холст **1920×1080** через CSS-переменную `--size` (`font-size: calc(1 * var(--size))`).

### 🚫 Строжайше запрещено:
1. **Фиксированные `px`**: запрещены для `width`, `height`, `padding`, `margin`, `font-size`, `border-radius`, `box-shadow`, `top/left/transform`.
   * *Исключение*: тонкие рамки `border: 1px solid ...` или `2px solid ...`.
2. **Единицы `rem`**: ломают масштабирование (привязаны к браузерному `html`, а не к `--size`). Заменяйте на `em`.
3. **`position: fixed` для сцен/оверлеев**: ломает соотношение 16:9 и вылезает на черные полосы леттербоксинга. Используйте `position: absolute; inset: 0;` внутри `.game-area` / `#app`.
4. **`vw` и `vh` внутри игры**: считаются от окна браузера, а не от игрового холста. Используйте `em` или `%`.

### 📐 Шпаргалка размеров (база 16px = 1em):
`1-2px` $\to$ `0.05-0.12em` | `4px` $\to$ `0.25em` | `8px` $\to$ `0.5em` | `12px` $\to$ `0.75em` | `16px` $\to$ `1em` | `24px` $\to$ `1.5em` | `32px` $\to$ `2em`

---

## 2. Архитектурные стандарты

* **Единый источник правды данных**: строго директория `src/renderer/public/data/` (алиас `@data` в коде/тестах, динамический `/data/...` в рантайме). Папка `src/renderer/data/` запрещена.
* **Аудиосистема**: расчет громкости строго через `commonVolume * categoryVolume / 10000`.
* **Модальные окна**: регистрация в `useModalStack.js` (закрытие по `ESC`).

---

## 3. Индекс систем и документации (`docs/`)

Подробные спецификации вынесены в папку `docs/`. При работе с системой обращайтесь к её файлу:

* [Карты и открытие точек (`docs/systems/MapSystem.md`)](docs/systems/MapSystem.md) — двухуровневая карта (`worldMap`/`localMap`), переключение `L`, `discoveredLocations`.
* [Интерактивные маркеры сцен (`docs/systems/SceneHotspots.md`)](docs/systems/SceneHotspots.md) — переходы между комнатами без карты, статусы `active`/`locked`/`hidden`.
* [Время и календарь (`docs/systems/TimeCalendar.md`)](docs/systems/TimeCalendar.md) — Земля 2138 vs Новый Мир (360 дней), 4 фазы суток, перемотка `advanceTime()`.
* [Сценарные действия и UI (`docs/ui/UIControl.md`)](docs/ui/UIControl.md) — затемнения `fade`, очистка `clearCharacters`, хоткеи `H` и удержание `Ctrl` (скип).
* [Диалоговая система (`docs/ui/DialogueSystem.md`)](docs/ui/DialogueSystem.md) — тайпрайтер, автоскрытие UI (`DIALOGUE_HIDE_UI_CONFIG`).
* [Персонажи и спрайты (`docs/characters/BodyStructure.md`)](docs/characters/BodyStructure.md) — структура `body.json`, `values.json`, слоты `equipment.json`.
* [Студия спрайтов и риггинга (`docs/characters/CharacterRigStudio.md`)](docs/characters/CharacterRigStudio.md) — Live2D-Lite студия, дробление тела, 2D-стикер глаз, повороты, анимации, пресеты.
* [Квесты и журнал (`useQuests.js`)](docs/systems/QuestsSystem.md) — древовидная иерархия (`parentId`), задачи (`tasks`), сюжетные заметки.
* [Инвентарь и экипировка (`docs/systems/Inventory.md`)](docs/systems/Inventory.md) — слоты экипировки, контекстное меню предметов.
* [Энциклопедия и персонажи (`docs/systems/EncyclopediaSystem.md`)](docs/systems/EncyclopediaSystem.md) — карточки NPC, модульные блоки `{ id, title, text }`, симпатии `*_symp`.
* [Распорядок дня NPC (`docs/systems/NPCScheduleSystem.md`)](docs/systems/NPCScheduleSystem.md) — размещение по времени/сезонам, интерактивность на сцене, меню `npc-menu`.
* [Система сохранений (`docs/systems/SaveSystem.md`)](docs/systems/SaveSystem.md) — сериализация `gameState` (`globalData`, `characterData`), IPC.
* [Архитектура новеллы (`docs/systems/StoryArchitecture.md`)](docs/systems/StoryArchitecture.md) — модули `useStory*`, хранилища `gameStore.js`, `modalStore.js`.
* [Изометрическая 2.5D система (`docs/systems/IsometricSystem.md`)](docs/systems/IsometricSystem.md) — сетка 64×32, высоты $Z$, A* pathfinding, RLE-формат карт, редактор.
* [Пошаговая боевая система (`docs/systems/CombatSystem.md`)](docs/systems/CombatSystem.md) — боёвка в стиле SoC: AP/MP, таймлайн, шаблоны оружия, knockback, Ring-Out.
* [Редактор данных и локализация (`docs/systems/DataEditorSystem.md`)](docs/systems/DataEditorSystem.md) — CRUD сущностей, древо специализаций классов и рас (Tree Canvas), менеджер языков, Electron IPC.
* [Крафт, ковка и экземпляры (`docs/systems/CraftingSystem.md`)](docs/systems/CraftingSystem.md) — 9 уровней редкости, сундуки (`useContainers.js`), наковальня Карна.
* [Древо навыков (`docs/systems/SkillTreeSystem.md`)](docs/systems/SkillTreeSystem.md) — ветки классов/рас, уровневая сетка, зависимости предков (`all`/`any`), SP.
* [Система безымянных мобов (`docs/systems/MobSystem.md`)](docs/systems/MobSystem.md) — расчёт статов из рас/классов, звёздность 1★–5★, экипировка по тирам, скалирование, агро/сон.

---

## 4. Контроль качества перед сдачей работы

1. Запустить тесты: `npm test` — все тесты Vitest должны быть **PASS**.
2. **Актуализация документации**: при внедрении механик или изменении форматов обновлять руководства в `docs/`, регистрировать в `docs/README.md` и в разделе 3 данного `AGENTS.md`.
