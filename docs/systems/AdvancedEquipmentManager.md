# Advanced Equipment Manager (менеджер экипировки)

> Документ одновременно описывает систему и служит **трекером выполнения**. Чекбоксы обновляются по ходу работы: `[ ]` — не сделано, `[~]` — в работе, `[x]` — готово и проверено.
> Базовые доки: [Экипировка и рендер](./EquipmentSystem.md), [Инвентарь](./Inventory.md), [Статы](./CharacterStatsSystem.md), [Сохранения](./SaveSystem.md).

## Цель

Продвинутая система экипировки: 38 конкретных слотов (22 группы), многослойная одежда, индексы принадлежности `L / R / LR / U`, блокировка смежных слотов, динамические слоты колец (2–10), хват двуручного оружия одной рукой со штрафом и интеграция с массивом `learnedSkills`, который идёт в `calculateCharacterStats`.

## Ключевые решения

| Решение | Почему |
| :--- | :--- |
| **Статусы слота выводятся (derived), а не хранятся.** `empty / occupied / blocked / locked` считает `getSlotStates()` из `equipment_slots` + определений предметов + `learnedSkills`. | Нельзя получить рассинхрон «предмет снят, а `blockedBy` остался». Правка `blocksSlots` в JSON сразу работает. |
| **Предмет хранится только в *основном* слоте** (`equipment_slots[slot] = itemId`). Второй слот пары `LR` — это `occupied` с `mirrorOf`, данные о нём лежат в `equipment_meta[primary].spans`. | Рендер (`calculateEquipmentBySlot`) и `resolveEquippedSkills` не должны видеть предмет дважды. |
| **`equipment_meta[primarySlot]`** = `{ spans: string[], grip: 'one' \| null, debuffActive: boolean }`. | Нужен для пар, одноручного хвата и штрафа. Сохраняется в дельте сейв-файла. |
| **Occupied ≠ Blocked.** Occupied — в слоте лежит предмет (или его пара). Blocked — слот перекрыт чужим предметом (`blocksSlots`, двуручное оружие) и пуст. | UI показывает разные состояния и разные причины. |
| **Конфликты решаются планом** (`planEquip`) — чистая функция возвращает `removes[]`; UI спрашивает подтверждение, если снимаются предметы не из целевого слота. | Игрок видит «Снять Сплошной купальник, чтобы надеть Трусы?» вместо тихой ошибки. |
| **Легаси-слоты** (`torso-1`, `legs-2`, `weapon-hand-1`, `underpants`…) остаются валидными алиасами. Для ГГ состояние мигрирует в новые id при загрузке/смене. NPC и риг-студия продолжают работать со старыми именами. | Не ломаем истории, сейвы и редакторы. |
| `learnedSkills` собирается из талантов персонажа + навыков из древа (`charactersProgression[id].skills`). Навыки предметов **не** участвуют в слотах колец/хвата. | Иначе цикл: кольцо открывает слот для самого себя. |

## Слоты

Группа → конкретные слоты (`SLOT_GROUPS`, [equipmentSlots.js](../../src/renderer/constants/equipmentSlots.js)):

| Группа | Слоты | Тип |
| :--- | :--- | :--- |
| head, glasses, mask, neck, top_underwear, top_mid, top_outer, bottom_underwear, bottom_outer, shoes, cloak, misc, belt, back | одноимённый | single |
| ears | `ears_1`, `ears_2` | numbered (1 = L, 2 = R) |
| shoulder, wrist, glove, sock, leg, hand | `<group>_L`, `<group>_R` | sided |
| ring | `ring_1` … `ring_10` | numbered, лимит из навыков |

Алиасы легаси-слотов: `torso-1→top_mid`, `torso-2→top_outer`, `torso-3→cloak`, `legs`/`legs-2→bottom_outer`, `underpants→bottom_underwear`, `feet→shoes`, `neck_1/neck-1→neck`, `hands→glove`, `weapon-hand-1→hand_R`, `weapon-hand-2/weapon_off→hand_L`.

## Формат предмета (`items/equipment.json`)

```json
{
  "id": "swimsuit_onepiece",
  "equipSlot": "top_underwear",
  "equipIndex": "U",
  "blocksSlots": ["bottom_underwear"],
  "isTwoHanded": false,
  "oneHandedDebuff": { "p_atk_mult": -0.2 }
}
```

| Поле | Значение |
| :--- | :--- |
| `equipSlot` | Группа (`ring`, `hand`) или конкретный слот (`shoulder_L`). Если нет — читается легаси `slot` (строка/массив). |
| `equipIndex` | `L`/`R` — строго один бок (чужой бок = ошибка `wrong_slot`). `LR` — парный набор, по умолчанию занимает оба слота, флагом `pair:false` — один. `U` — любой свободный слот группы, но не оба сразу. Для single-групп не нужен. |
| `blocksSlots` | Слоты/группы, которые предмет перекрывает. Занятые ими предметы снимаются (с подтверждением). |
| `isTwoHanded` | Занимает `hand_R`, блокирует `hand_L`. |
| `oneHandedDebuff` | Множители статов при хвате одной рукой. По умолчанию `{ "p_atk_mult": -0.2 }`. Ключи `p_atk/p_def/m_atk/m_def` и обычные алиасы статов + суффикс `_mult`. |

## Навыки (`skills/talents/talents.json`, поле `data`)

| Поле | Эффект |
| :--- | :--- |
| `ring_slots_bonus` (число) | `+N` открытых колец поверх базовых 2, максимум 10. |
| `two_handed_one_grip` (bool) | Разрешает хват двуручного оружия одной рукой (штраф `oneHandedDebuff`). |

Потеря навыка → `reconcileEquipment()` снимает кольца из закрытых слотов и оружие с одноручным хватом обратно в инвентарь.

## Состояние персонажа

```json
{
  "equipment_slots": { "top_underwear": "swimsuit_onepiece", "hand_R": "greatsword_iron" },
  "equipment_meta": { "hand_R": { "spans": [], "grip": "one", "debuffActive": true } }
}
```

## Архитектура кода

| Файл | Роль |
| :--- | :--- |
| `src/renderer/constants/equipmentSlots.js` | Каталог слотов, группы, подписи, алиасы, зоны paper-doll. |
| `src/renderer/utils/equipmentManager.js` | Чистая логика: `resolveItemPlacement`, `getSlotStates`, `planEquip`, `applyEquipPlan`, `unequipSlot`, `reconcileEquipment`, `migrateLegacyEquipment`, `buildEquipmentItemsForStats`, `applyOneHandedDebuff`, `getRingSlotLimit`, `canUseOneHandedGrip`, `collectLearnedSkills`. |
| `src/renderer/composables/useCharacterEquipment.js` | Оркестрация: инвентарь, звук, события, промпты. |
| `src/renderer/composables/useEquipPrompt.js` | Синглтон-состояние промежуточного попапа (Drag&Drop). |
| `src/renderer/composables/useLearnedSkills.js` | `computed learnedSkills` для персонажа. |
| `src/renderer/components/game/inventory/EquipOptionsPopup.vue` | Микро-окно с галочками и списком конфликтов. |
| `src/renderer/components/game/inventory/InventoryItems.vue` | Сетка paper-doll, DnD, индикация Locked/Blocked. |
| `src/renderer/utils/stats/characterStats.js` | Применяет `debuffActive` перед подсчётом. |
| `scripts/test-equipment-manager.mjs` | Node-тесты логики (`node scripts/test-equipment-manager.mjs`). |

## UI-поток Drag&Drop

1. Игрок отпускает предмет над слотом → `emit('equip', { slot, itemId, inventoryIndex })`.
2. `handleEquip` строит `planEquip`. Если нет вариантов и конфликтов — надевает сразу.
3. Если у предмета `LR` (надевается на один слот), либо двуручное + навык хвата, либо снимаются «чужие» предметы — открывается `EquipOptionsPopup` рядом с курсором: галочки *«Занять оба слота (L и R)»* / *«Использовать как одноручное (штраф)»* и список «Будет снято: …».
4. Изменение галочек пересчитывает план вживую. «Надеть» → commit, «Отмена»/`Esc` → ничего не меняется.

---

## 📋 Трекер выполнения

### Этап 0. Подготовка
- [x] Изучить текущую систему (слоты `torso-1`…, `equipment_slots`, DnD на `interactjs`, `calculateCharacterStats`).
- [x] Создать этот документ.

### Этап 1. Схема предметов
- [x] Поле `equipSlot` (с фолбэком на легаси `slot`).
- [x] Поле `equipIndex`: `L` / `R` / `LR` / `U`.
- [x] Поле `blocksSlots`.
- [x] Поле `isTwoHanded`.
- [x] Поле `oneHandedDebuff` (+ дефолт `{ p_atk_mult: -0.2 }`).
- [x] Тестовые предметы: сплошной купальник, кольца, двуручный меч, парные перчатки.

### Этап 2. Ядро менеджера
- [x] Каталог слотов (38 слотов) + алиасы легаси.
- [x] Инициализация всех слотов (`ensureEquipmentSlots`).
- [x] Валидация индексов `L/R/U` (`wrong_slot`).
- [x] Статусы `occupied` / `blocked` / `locked` (`getSlotStates`, `blockedBy`).
- [x] `planEquip` + авто-снятие при конфликте (`removes[]`).
- [x] `unequipSlot` (зеркальные слоты, meta).
- [x] Миграция легаси-слотов ГГ.

### Этап 3. Пассивки, кольца, хват
- [x] `LR`: по умолчанию оба слота, флаг `pair:false` — один.
- [x] Лимит колец: `ring_1/2` открыты, `ring_3…10` locked.
- [x] `reconcileEquipment`: слушатель `learnedSkills`, авто-снятие лишних колец.
- [x] Двуручное: `hand_R` + блок `hand_L`.
- [x] Одноручный хват (`equipWeapon(item, isOneHandedGrip)`), требует навык, ставит `debuffActive`.
- [x] `calculateCharacterStats` режет статы при `debuffActive`.
- [x] Талант-источник: `ring_slots_bonus`, `two_handed_one_grip` в `talents.json`.

### Этап 4. Vue 3 UI
- [x] Сетка paper-doll со всеми слотами (зоны).
- [x] Индикация Locked (замок) и Blocked (штриховка + причина).
- [x] Попап подтверждения/галочек (`EquipOptionsPopup`, закрытие по `Esc`).
- [x] Галочка «Одноручное (штраф)» для двуручного оружия.
- [x] Галочка «Занять оба слота (L и R)» для `LR`.
- [x] Контекстное меню «Одеть» через новый резолвер слотов.

### Этап 5. Интеграция и качество
- [x] Сохранение `equipment_meta` в дельте сейва.
- [x] Реакция на изменение `learnedSkills` в оркестраторе.
- [x] Редактор данных: список слотов и поля предмета.
- [x] Node-тесты логики проходят (33/33 тестов).
- [x] `npm run lint:styles` без новых ошибок (147/147 файлов).
- [x] Обновить `docs/README.md`, `AGENTS.md`, `EquipmentSystem.md`, `Inventory.md`.

### Журнал
| Дата | Что сделано |
| :--- | :--- |
| 2026-10-10 | Анализ кодовой базы, создан документ и трекер архитектуры. |
| 2026-10-10 | Реализована схема предметов, каталог слотов (`equipmentSlots.js`), ядро логики (`equipmentManager.js`) с поддержкой `Occupied`/`Blocked`/`Locked`, `L/R/U/LR`, `blocksSlots`, двуручного хвата и динамических колец. |
| 2026-10-10 | Интеграция боевых статов (`characterStats.js`), таланты `ring_bearer` и `two_handed_one_grip` в `talents.json`, тестовые предметы в `equipment.json`. |
| 2026-10-10 | Vue 3 UI: компонент `EquipOptionsPopup.vue`, зоны слотов paper-doll в `InventoryItems.vue`, индикаторы блокировки/замка, контекстное меню, композиции `useCharacterEquipment`, `useEquipPrompt`, `useLearnedSkills`, оркестратор и сейвы. |
| 2026-10-10 | Написан тестовый сьют `scripts/test-equipment-manager.mjs` (33/33 тестов успешно). Пройден `npm run lint:styles` (147/147 файлов). Обновлена документация (`AGENTS.md`, `README.md`, `EquipmentSystem.md`, `Inventory.md`). |
