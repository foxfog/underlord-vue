# Система распорядка дня, состояний и размещения NPC (NPC Schedule & Presence System)

В игре реализована гибкая многоуровневая система размещения неигровых персонажей (NPC) в сценах и локациях мира (в стиле *The Elder Scrolls V: Skyrim*), поддерживающая как свободное исследование мира, так и линейные сюжетные катсцены.

---

## 1. Концепция и иерархия приоритетов

Нахождение персонажа в той или иной локации определяется динамически.

### Принцип «По умолчанию персонажа нигде нет»:
Если для персонажа не задан распорядок дня, не выполнены условия или он не привязан к локации, персонаж отсутствует на сценах мира (off-screen).

### Иерархия приоритетов:
```
┌────────────────────────────────────────────────────────┐
│ 1. Сюжетное переопределение (Manual Override)          │
│    Экшен { type: "npc", action: "override", ... }      │
│    или прямое управление показом в катсцене            │
└──────────────────────────┬─────────────────────────────┘
                           │ (если нет override)
                           ▼
┌────────────────────────────────────────────────────────┐
│ 2. Специальные условия (Квесты, Статус NPC, Переменные)│
│    Например, state: "injured" (староста ранен в постели│
│    или global.carne_under_attack === true              │
└──────────────────────────┬─────────────────────────────┘
                           │ (если спец-условия не сработали)
                           ▼
┌────────────────────────────────────────────────────────┐
│ 3. Базовый распорядок дня (Time-of-Day Schedule)       │
│    Время суток (morning, day, evening, night), сезон   │
└──────────────────────────┬─────────────────────────────┘
                           │ (если ни одно правило не подошло)
                           ▼
┌────────────────────────────────────────────────────────┐
│ 4. Отсутствие персонажа на сцене (null)                │
└────────────────────────────────────────────────────────┘
```

---

## 2. Формат описания расписания (`data/characters/schedules.json`)

Расписания персонажей хранятся в файле `src/renderer/public/data/characters/schedules.json`:

```json
{
  "characters": {
    "carne-chief": {
      "defaultLocation": "carne_chief_house",
      "locationKnown": true,
      "schedules": [
        {
          "id": "chief_injured",
          "targetScene": "carne_chief_bed",
          "position": { "r": 10, "l": "auto" },
          "orientation": "left",
          "conditions": {
            "state": "injured"
          }
        },
        {
          "id": "chief_square_day",
          "targetScene": "carne_village_square",
          "position": { "l": 40, "r": "auto" },
          "orientation": "right",
          "conditions": {
            "timePhase": ["morning", "day"]
          }
        },
        {
          "id": "chief_house_default",
          "targetScene": "carne_chief_house",
          "position": { "r": 15, "l": "auto", "b": 0 },
          "orientation": "left",
          "scale": 1,
          "conditions": {
            "timePhase": ["evening", "night"]
          }
        }
      ]
    }
  }
}
```

### Поддерживаемые условия (`conditions`):

| Ключ | Тип | Описание |
| :--- | :--- | :--- |
| `timePhase` | `string \| string[]` | Фаза суток: `"morning"`, `"day"`, `"evening"`, `"night"`. |
| `season` | `string \| string[]` | Сезон: `"spring"`, `"summer"`, `"autumn"`, `"winter"`. |
| `hour` / `hours` | `number \| { min, max }` | Точный час (`hour: 14`) или диапазон (`hours: { min: 8, max: 20 }`). |
| `dayOfWeek` | `number \| string \| (number\|string)[]` | День недели. Число **1–7** (1=Пн, 7=Вс), имя на EN (`"Monday"`, `"Mon"`) или RU (`"Понедельник"`, `"Пн"`). Массив — OR-условие. |
| `dayOfMonth` | `number \| number[] \| { min, max }` | Число месяца (1–30 для Нового Мира, 1–31 для реального). Массив — OR, диапазон — включительно. |
| `month` | `number \| number[] \| string` | Номер месяца (1–12), массив номеров, или полное название месяца на RU/EN. |
| `state` | `string \| string[]` | Персональный статус NPC (изменяется через `set-state`, по умолчанию `"default"`). |
| `quest` | `string \| object` | Строка: `"questId"` (квест `active`). Объект: `{ "id": "...", "status": "...", "task": "..." }`. |
| `variable` | `string` | Выражение для безопасного вычислителя: `"global.chief_alive === true"`. |

Все условия внутри одного объекта `conditions` — AND (все должны выполняться одновременно).

**Примеры:**

```json
{ "dayOfWeek": [6, 7] }
```
→ Только по выходным (Сб/Вс).

```json
{ "dayOfWeek": "Monday", "timePhase": "morning" }
```
→ Только в понедельник утром.

```json
{ "dayOfMonth": { "min": 1, "max": 10 }, "month": 6 }
```
→ Первые 10 дней шестого месяца (в Новом Мире — «Месяц первой искры»).

```json
{ "month": "Месяц первой искры" }
```
→ Весь шестой месяц Нового Мира (поиск по полному имени).

---

## 3. Сценарные действия (`type: "npc"`)

Движок визуальной новеллы поддерживает специальные шаги для управления NPC:

### 1. Установка персонального статуса:
```json
{
  "type": "npc",
  "action": "set-state",
  "character": "carne-chief",
  "state": "injured"
}
```

### 2. Сюжетное переопределение позиции (Override):
```json
{
  "type": "npc",
  "action": "override",
  "character": "carne-chief",
  "scene": "carne_village_square",
  "position": { "r": 25, "l": "auto" },
  "orientation": "left"
}
```

### 3. Сброс переопределения (возврат к штатному распорядку):
```json
{
  "type": "npc",
  "action": "clear-override",
  "character": "carne-chief"
}
```

### 4. Известность местоположения в Журнале:
```json
{
  "type": "npc",
  "action": "set-known",
  "character": "carne-chief",
  "known": true
}
```

---

## 4. Автоматическое наполнение сцен и перемотка времени

1. **При смене сцены (`changeScene`)**:
   - Движок очищает предыдущие спрайты (если задано `clearCharacters: true`).
   - Вызывает `useNpcSchedule().populateSceneCharacters(sceneId, context, visibleCharacters, characterData)`.
   - Если в `changeScene` передан флаг `populateNpcs: false` или `autoPopulate: false`, автоматическое наполнение подавляется (для строго срежиссированных катсцен).
2. **При перемотке времени (`advanceTime`)**:
   - Автоматически вызывается `useNpcSchedule().refreshSceneNpcs(sceneId, context, visibleCharacters, characterData)`.
   - Персонажи, чей распорядок наступил, появляются на сцене.
   - Персонажи, чей распорядок завершился (например, староста ушёл с площади домой на ночь), покидают сцену.

---

## 5. Карточки в Журнале / Энциклопедии (`JournalModal.vue`)

В детальной карточке персонажа отображается строка текущего местонахождения:
* Если местонахождение открыто игроку:
  `📍 Местонахождение: Дом старосты (Деревня Карн)`
* Если местонахождение не исследовано или скрыто:
  `📍 Местонахождение: Неизвестно`
* **Автоматическое открытие**: как только игрок впервые посещает сцену, где находится NPC, статус `locationKnown` автоматически переходит в `true`.

---

## 6. Сохранение и загрузка (Save & Load)

Все оверрайды, персональные статусы NPC и флаги известности сохраняются в объекте `gameState.global.npcStates`:
* Автоматически сериализуются при вызове `saveGame`.
* Восстанавливаются при вызове `loadGame` / `restoreGameState`.
* Сбрасываются в исходное состояние при `resetGameState`.

---

## 7. Добавление нового NPC

1. Поместите спрайт в `src/renderer/public/images/sprites/characters/<char-id>/default.webp` (используйте только латинские символы в ID!).
2. Создайте файлы данных в `src/renderer/public/data/characters/<char-id>/`:
   - `values.json`
   - `body.json`
   - `equipment.json`
3. Зарегистрируйте `<char-id>` в `src/renderer/public/data/characters/characters.json`.
4. Задайте распорядок дня в `src/renderer/public/data/characters/schedules.json`.

---

## 8. Интерактивность и диалоговые меню при клике на NPC (Character Interaction & NPC Menus)

Персонажи на сцене могут реагировать на клик игрока (появление курсора `pointer` и плавной подсветки `brightness/drop-shadow`).

### Конфигурация в `schedules.json`
Интерактивность настраивается либо на уровне персонажа (`defaultInteraction`), либо в конкретном правиле расписания (`interaction`):

```json
{
  "carne-chief": {
    "defaultLocation": "carne_chief_house",
    "defaultInteraction": {
      "type": "npc-menu",
      "story": "carne-chief/menu"
    },
    "schedules": [
      {
        "id": "chief_in_house",
        "targetScene": "carne_chief_house",
        "position": { "r": 15, "l": "auto", "b": 0 },
        "orientation": "left",
        "scale": 1,
        "interaction": {
          "type": "npc-menu",
          "story": "carne-chief/menu"
        }
      }
    ]
  }
}
```

### Поток событий:
1. `Character.vue` отслеживает клик и при наличии `interaction` эмитит `character-click`.
2. `CharacterList.vue` проксирует событие в `VisualNovel.vue`, откуда оно передаётся в `Game.vue`.
3. `Game.vue` при получении `interaction.type === 'npc-menu'` запускает макрос меню через `visualNovel.value.goto(interaction.story)`.
4. Макрос (например, `carne-chief/menu.json`) выводит выбор («Поговорить» / «Назад»):
   - «Поговорить» → переход к диалоговой ветке (`carne-chief/talk.json`).
   - «Назад» → `{ "type": "goto", "target": "<scene_id>" }` (возврат в интерактивный режим сцены).
