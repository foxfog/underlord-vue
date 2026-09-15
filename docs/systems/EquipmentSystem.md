# Система оборудования персонажей

## Обзор

Система оборудования позволяет отображать различные предметы (одежду, оружие и т.д.) поверх спрайтов персонажа. Каждый предмет может состоять из нескольких частей, которые отображаются на разных частях тела персонажа.

## Ключевая особенность: Иерархическое отображение

Каждая часть оборудования отображается **внутри** соответствующего родительского спрайта (`char-part`). Это означает, что если предмет состоит из нескольких частей (например, рубашка с рукавами), каждая часть будет отрисована в своём родительском спрайте:

```
char-part (body)
├── char-part-sprite (body image)
└── equip-part (рубашка на body)
    └── equip-part-sprite (image)

char-part (arm_left)
├── char-part-sprite (arm_left image)
└── equip-part (рубашка на arm_left)
    └── equip-part-sprite (image)

char-part (arm_right)
├── char-part-sprite (arm_right image)
└── equip-part (рубашка на arm_right)
    └── equip-part-sprite (image)
```

## Структура данных

### values.json - Слоты оборудования

Каждый персонаж имеет `equipment_slots` - словарь слотов, где могут быть размещены предметы:

```json
{
  "equipment_slots": {
    "head": null,
    "neck-1": null,
    "torso-1": null,
    "torso-2": null,
    "torso-3": null,
    "legs": null,
    "feet": null,
    "weapon-hand-1": null,
    "weapon-hand-2": null,
    "hands": null,
    "weapon_off": null
  }
}
```

Значение слота может быть:
- `null` - слот пуст
- `"item-id"` - строка с ID предмета из `equipment.json`

### equipment.json - Определение предметов

Массив объектов, где каждый объект описывает предмет:

```json
[
  {
    "id": "tshirt-red",
    "parts": [
      {
        "parent": "body",
        "image": "/images/sprites/characters/char/body.png",
        "offset": {
          "x": 0,
          "y": 0
        }
      },
      {
        "parent": "arm_left",
        "image": "/images/sprites/characters/char/arm left.png"
      },
      {
        "parent": "arm_right",
        "image": "/images/sprites/characters/char/arm right.png"
      }
    ]
  },
  {
    "id": "sword-diamond",
    "parts": [
      {
        "parent": "arm_right3",
        "image": "/images/sprites/characters/char/arm3 right.png"
      }
    ]
  }
]
```

**Структура предмета:**
- `id` (string) - уникальный идентификатор предмета
- `parts` (array) - массив частей предмета

**Структура части:**
- `parent` (string) - имя родительского спрайта из `body.json` (ОБЯЗАТЕЛЬНО)
  - Часть оборудования будет отрисована **внутри** этого спрайта
  - Родитель должен существовать в `body.json`, иначе часть не отобразится
- `image` (string) - путь к изображению спрайта
- `offset` (object, опционально) - смещение относительно родителя
  - `x` (number) - смещение по горизонтали в процентах
  - `y` (number) - смещение по вертикали в процентах

## Как это работает

### 1. Загрузка данных

При загрузке персонажа в `VisualNovel.vue`:

```javascript
// 1. Загружаются три файла
const valuesData = await loadDataFromPublic(`/data/characters/${charId}/values.json`);
const bodyData = await loadDataFromPublic(`/data/characters/${charId}/body.json`);
const equipmentData = await loadDataFromPublic(`/data/characters/${charId}/equipment.json`);

// 2. Создается карта предметов по ID
const equipmentMap = {};
equipmentData.forEach(item => {
  equipmentMap[item.id] = item;
});

// 3. Строится структура оборудования по слотам
const equipmentBySlot = {};
if (valuesData.equipment_slots) {
  for (const [slotName, itemId] of Object.entries(valuesData.equipment_slots)) {
    if (itemId && equipmentMap[itemId]) {
      equipmentBySlot[slotName] = {
        id: itemId,
        item: equipmentMap[itemId],
        parts: equipmentMap[itemId].parts || []
      };
    }
  }
}

// 4. Объединяется в объект персонажа
const mergedCharacter = {
  ...valuesData,
  sprites: bodyData,
  equipment: equipmentData,
  equipmentBySlot: equipmentBySlot
};
```

### 2. Отображение

В компоненте `Character.vue`:
```vue
<SpritePart 
  :sprite="sprite" 
  :sprite-name="spriteName"
  :character-id="character.id"
  :sprites="character.sprites"
  :sprites-by-parent="spritesByParent"
  :equipment-by-slot="character.equipmentBySlot"
/>
```

В компоненте `SpritePart.vue`:
```vue
<!-- Базовый спрайт -->
<div class="char-part-sprite">
  <img :src="sprite.image" ... />
</div>

<!-- Оборудование для этого спрайта (находится внутри char-part) -->
<EquipPart 
  v-if="part.parent === spriteName"
  :part="part"
  :part-name="`${equip.id}-${partIndex}`"
  :character-id="characterId"
/>

<!-- Дочерние спрайты (рекурсивно) -->
<SpritePart :sprite="childSprite" ... />
```

## Пример использования

### Шаг 1: Определить слоты в values.json

```json
{
  "id": "momonga",
  "name": "Момонга",
  "equipment_slots": {
    "torso-1": "tshirt-red",
    "weapon-hand-1": "sword-diamond",
    "neck-1": "pendant-zen"
  }
}
```

### Шаг 2: Определить предметы в equipment.json

```json
[
  {
    "id": "tshirt-red",
    "parts": [
      {
        "parent": "body",
        "image": "/images/equipment/tshirt-red-body.png"
      },
      {
        "parent": "arm_left",
        "image": "/images/equipment/tshirt-red-arm-left.png"
      },
      {
        "parent": "arm_right",
        "image": "/images/equipment/tshirt-red-arm-right.png"
      }
    ]
  }
]
```

### Результат отображения

```
char-part (body)
├── char-part-sprite (body)
└── equip-part (tshirt-red часть для body)
    └── tshirt-red-body.png

char-part (arm_left)
├── char-part-sprite (arm_left)
└── equip-part (tshirt-red часть для arm_left)
    └── tshirt-red-arm-left.png

char-part (arm_right)
├── char-part-sprite (arm_right)
└── equip-part (tshirt-red часть для arm_right)
    └── tshirt-red-arm-right.png
```


## Ограничения экипировки (Equip Restrictions)

Предметы снаряжения могут иметь системные ограничения на использование персонажами. Валидация выполняется функциями `canCharacterEquipItem(character, itemDef, invItem)` и `getEquipRestrictionReasons(character, itemDef, invItem)` в `src/renderer/utils/equipment.js`.

### 1. Критерии ограничений:

| Параметр | Поле в предмете | Правило валидации | Поведение при отсутствии/пустом массиве |
| :--- | :--- | :--- | :--- |
| **Минимальный уровень** | `lvl` (или `lvl_min`) | Уровень персонажа `character.lvl` должен быть $\ge$ указанного | Ограничение не применяется (доступно с 1 уровня) |
| **Конкретные персонажи** | `characters` (`string[]`) | ID персонажа должен входить в список `item.characters` | Доступно любым персонажам |
| **Пол** | `genders` (`string[]`) | Пол персонажа `character.gender` должен совпадать с одним из разрешенных (`male`, `female`, `genderless`, `hermaphrodite`) | **Разрешено всем полам** без исключений (компактный JSON) |
| **Классы** | `classs` / `classes` (`string[]`) | Хотя бы один класс персонажа `character.classs` должен совпадать с разрешёнными | Доступно персонажам любых классов |
| **Расы** | `races` (`string[]`) | Хотя бы одна раса персонажа `character.races` должна совпадать с разрешёнными | Доступно персонажам любых рас |

### 2. Интеграция в игровые системы:

- **Контекстное меню (`InventoryContextMenu.vue`)**:
  Пункт «Экипировать» блокируется (`disabled`), если персонаж не удовлетворяет требованиям, а в тултипе выводится список причин несовместимости (например, *«Требуется: Уровень 5, Класс: Воин»*).
- **Перетаскивание в инвентаре (`InventoryItems.vue`)**:
  При драге предмета метод `highlightCompatibleSlots` подсвечивает слоты только в том случае, если `canCharacterEquipItem` возвращает `true`. Бросок предмета на слот персонажа отклоняется, если требования не выполнены.
- **Инспектор предмета (`ItemInfoModal.vue`)**:
  Отображает блок «Требования экипировки» со стилизованными бейджами минимального уровня, пола (с иконками 👨/👩/⚪/⚧), классов, рас и списка персонажей.
- **Редактор данных (`DataEditorView.vue`)**:
  Позволяет интерактивно настраивать ограничения экипировки через чипсы с привязкой к сущностям проекта и автоматическим очищением пустых массивов при сохранении.

## Важные замечания

1. **Родительский спрайт ОБЯЗАТЕЛЕН** — каждая часть оборудования должна указывать на существующий спрайт из `body.json`
2. **ID предмета** в `equipment_slots` должен точно совпадать с `id` в `equipment.json`
3. **Иерархия** — оборудование отображается внутри `char-part`, поэтому оно автоматически наследует масштабирование и позиционирование родительского спрайта
4. **Порядок отображения** — оборудование отображается после базового изображения спрайта, поэтому оно видно поверх него
5. **Смещения** работают в процентах и позволяют точно позиционировать части оборудования
6. **Ограничения по полу**: если у предмета поле `genders` не задано или является пустым массивом, он разрешён персонажам любого пола.

## Файлы компонентов

- [Character.vue](../../src/renderer/components/game/characters/Character.vue) — основной компонент персонажа
- [SpritePart.vue](../../src/renderer/components/game/characters/SpritePart.vue) — компонент для отображения части спрайта (содержит оборудование внутри себя)
- [EquipPart.vue](../../src/renderer/components/game/characters/EquipPart.vue) — компонент для отображения части оборудования
- [equipment.js](../../src/renderer/utils/equipment.js) — утилиты расчета слотов и валидатор `canCharacterEquipItem`
- [InventoryContextMenu.vue](../../src/renderer/components/game/inventory/InventoryContextMenu.vue) — контекстное меню экипировки с проверкой требований
- [InventoryItems.vue](../../src/renderer/components/game/inventory/InventoryItems.vue) — сетка инвентаря и DND экипировки
- [ItemInfoModal.vue](../../src/renderer/components/game/inventory/ItemInfoModal.vue) — модальное окно деталей предмета и его требований
