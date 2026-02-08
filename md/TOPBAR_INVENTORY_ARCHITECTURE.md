# Топбар и Инвентарь - Архитектурная диаграмма

## Структура UI

```
┌─────────────────────────────────────────────────────────┐
│                        TOPBAR (z-index: 100)            │
│  ┌────────────────────────────────────────────────────┐ │
│  │ [📊 Статы]  [🎒 Инвентарь]                         │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    GAME AREA (margin-top: 60px)         │
│  ┌────────────────────────────────────────────────────┐ │
│  │                                                    │ │
│  │         VisualNovel компонент                      │ │
│  │                                                    │ │
│  │                                                    │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  HOTBAR (z-index: 249, fixed bottom)               │ │
│  │  [История] [Главное меню] [Сохранить] [Загрузить] │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Компоненты и их иерархия

```
Game.vue
├── Topbar
│   ├── @open-stats → toggleStatsModal()
│   └── @open-inventory → toggleInventoryModal()
├── VisualNovel
├── CharacterStatsModal (уже существовал)
├── InventoryModal (новый)
│   ├── Вкладка: Инвентарь
│   │   └── Список предметов
│   ├── Вкладка: Статистика
│   │   ├── HP bar
│   │   ├── MP bar
│   │   ├── Attack
│   │   └── Defense
│   └── Вкладка: Способности
│       └── Список способностей
├── DynamicContentArea
├── MainMenu
├── HistoryModal
└── Hotbar
```

## Поток управления

### Открытие Инвентаря
```
Пользователь нажимает [🎒 Инвентарь] на Topbar
                    ↓
Topbar emits 'open-inventory'
                    ↓
Game.vue получает событие
                    ↓
toggleInventoryModal() вызывается
                    ↓
showInventoryModal.value = true
                    ↓
InventoryModal становится видимым
                    ↓
Отображаются данные:
- character.inventory.items
- character.abilities
- itemsData (loaded от equipment & other JSON)
```

### Загрузка данных предметов (onMounted)
```
Game.vue мтонтируется
                    ↓
Fetch /data/characters/equipment.json
Fetch /data/characters/other.json
                    ↓
Merge оба массива в itemsData object
  itemsData = {
    "gasmask": { id, name, weight, ... },
    "sword-diamond": { id, name, weight, ... },
    "ygdrasil-coin-old": { id, name, stackable, ... },
    ...
  }
                    ↓
itemsData передается в InventoryModal
                    ↓
InventoryModal использует для отображения названий
```

## Структура данных

### Character
```javascript
character = {
  id: "mc",
  name: "Я",
  hp: 10,
  hpmax: 10,
  mp: 10,
  mpmax: 10,
  attack: 2,
  defense: 1,
  
  // Новое поле
  inventory: {
    items: [
      { itemId: "gasmask", quantity: 1 },
      { itemId: "ygdrasil-coin-old", quantity: 23 }
    ]
  },
  
  // Новое поле
  abilities: [
    {
      id: "power_attack",
      name: "Мощная атака",
      description: "Нанести увеличенный урон врагу..."
    }
  ]
}
```

### ItemsData
```javascript
itemsData = {
  "gasmask": {
    id: "gasmask",
    part: "head",
    weight: 0.5,
    stats: { hp: 2, defense: 5 }
  },
  "ygdrasil-coin-old": {
    id: "ygdrasil-coin-old",
    weight: 0.02,
    stackable: true
  }
}
```

## Z-index слои

```
Z-index: 1000  ← InventoryModal & CharacterStatsModal (модальные окна)
Z-index: 250   ← Menu overlay (меню в игре)
Z-index: 249   ← Hotbar
Z-index: 100   ← Topbar
Z-index: 0     ← VisualNovel контент
```

## Состояния

### Game.vue refs
```javascript
showStatsModal: boolean        // CharacterStatsModal видимость
showInventoryModal: boolean    // InventoryModal видимость
mcCharacter: Object            // Данные персонажа
itemsData: Object              // Справочник предметов

// UI Visibility
uiVisibility: {
  all: boolean,
  topbar: boolean,      // Контролирует видимость Topbar
  hotbar: boolean,
  dialogue: boolean
}
```

### InventoryModal refs
```javascript
activeTab: 'inventory' | 'statistics' | 'abilities'  // Активная вкладка
```

## CSS классы

### Topbar
- `.topbar` - контейнер
- `.topbar-btn` - кнопка
- `.topbar-btn:hover` - эффект наведения
- `.topbar-btn:active` - эффект нажатия

### InventoryModal
- `.modal` - оверлей
- `.modal-content` - основное окно
- `.modal-header` - заголовок
- `.modal-tabs` - контейнер вкладок
- `.modal-tab` - вкладка
- `.modal-tab.active` - активная вкладка
- `.modal-body` - содержимое
- `.tab-content` - содержимое вкладки
- `.inventory-item` - элемент инвентаря
- `.ability-item` - элемент способности
- `.stat-bar` - полоска статса
- `.stat-fill` - заполнение полоски

## Вычисляемые свойства

### Game.vue
```javascript
showTopbar = computed(() => 
  uiVisibility.all && uiVisibility.topbar
)
```

### InventoryModal
```javascript
inventoryItems = computed(() => 
  character.inventory.items.map(item => ({
    itemId: item.itemId,
    itemName: itemsData[item.itemId].name,
    weight: itemsData[item.itemId].weight,
    quantity: item.quantity || 1
  }))
)

abilities = computed(() =>
  character.abilities?.map(ability => ({
    id: ability.id,
    name: ability.name,
    description: ability.description
  })) || []
)

hpPercentage = computed(() => hp / hpmax * 100)
mpPercentage = computed(() => mp / mpmax * 100)
```

## События (Emits)

### Topbar
```javascript
@open-stats       → передает: (no payload)
@open-inventory   → передает: (no payload)
```

### InventoryModal
```javascript
@close → передает: (no payload)
```

## Props

### Topbar
```javascript
props: {
  character: Object (default: null)
}
```

### InventoryModal
```javascript
props: {
  isVisible: Boolean (default: false),
  character: Object (default: null),
  itemsData: Object (default: {})
}
```

## Интерактивность

### Topbar
- Кнопка может быть нажата → Emits событие
- Hover эффект → кнопка поднимается на 1px
- Active состояние → визуальное подтверждение

### InventoryModal
- Клик на вкладку → переключение содержимого
- Клик на × → закрывает модальное окно
- Клик вне модального окна → закрывает его
- Скроллинг в modal-body → пользовательский скроллбар
- Скроллинг через вкладки работает плавно

## Стили (SCSS)

### Topbar
```scss
.topbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: linear-gradient(...);
  backdrop-filter: blur(2px);
  z-index: 100;
}

.topbar-btn {
  transition: all 0.2s ease;
  &:hover {
    transform: translateY(-1px);
  }
}
```

### InventoryModal
```scss
.modal-tab {
  transition: all 0.2s ease;
  &.active {
    background: #4a9eff;
    color: #fff;
  }
}

.modal-body {
  overflow-y: auto;
  // Кастомный скроллбар
  &::-webkit-scrollbar {
    width: 8px;
  }
}
```
