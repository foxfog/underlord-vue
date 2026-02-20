# Game Rules Engine - Система условной логики

## Описание

**Game Rules Engine** - это независимая система управления условиями и действиями в игре. Вместо добавления логики в JSON истории, все правила живут в отдельных JS файлах с читаемым синтаксисом.

## Основные компоненты

### 1. GameRulesEngine (`services/gameRulesEngine.js`)
Основной класс, который:
- Регистрирует правила
- Проверяет условия
- Выполняет действия
- Отслеживает статистику

### 2. useGameRules (`composables/useGameRules.js`)
Vue Composable для удобной работы с engine в компонентах.

### 3. storyRules (`constants/storyRules.js`)
Конфигурационный файл со всеми правилами (примеры и шаблоны).

## Структура правила

```javascript
{
  id: 'unique_id',                    // Уникальный идентификатор
  name: 'Название правила',           // Человеческое название
  description: 'Описание',            // Что оно делает
  enabled: true,                      // Включено ли
  once: false,                        // Выполнить только один раз
  debounce: 500,                      // Минимальный интервал (мс)
  
  conditions: [                       // Массив условий (ВСЕ должны быть истинны)
    { ... }
  ],
  
  actions: [                          // Массив действий для выполнения
    { ... }
  ],
  
  onTriggered: (gameState) => {      // Кастомный callback
    // ...
  }
}
```

## Типы условий

### 1. Variable (Переменные)
```javascript
{
  type: 'variable',
  path: 'character.mc.health',      // Путь к переменной через точку
  operator: 'lt',                   // Оператор сравнения
  value: 50
}
```

### 2. Equipment (Оборудование)
```javascript
{
  type: 'equipment',
  field: 'mask',                    // Какой слот проверяем
  operator: 'ne',                   // Не равно
  value: 'gasmask'
}
```

### 3. Location (Локация)
```javascript
{
  type: 'location',
  field: 'current',                 // или 'hasAttribute'
  operator: 'in',
  value: ['city', 'factory']
}
```

### 4. Story (История)
```javascript
{
  type: 'story',
  field: 'isPlaying',               // или 'id', 'active'
  operator: 'eq',
  value: true
}
```

### 5. Character (Персонаж)
```javascript
{
  type: 'character',
  field: 'health',                  // или 'isDead'
  operator: 'lt',
  value: 30
}
```

### 6. Custom (Кастомная функция)
```javascript
{
  type: 'custom',
  check: (gameState) => {
    // Ваша логика
    return someCondition;
  }
}
```

## Операторы сравнения

- `eq`, `=`, `==` - равно
- `ne`, `!=` - не равно
- `gt`, `>` - больше
- `gte`, `>=` - больше или равно
- `lt`, `<` - меньше
- `lte`, `<=` - меньше или равно
- `in` - есть в массиве
- `nin`, `not-in` - нет в массиве
- `contains` - строка содержит подстроку
- `startsWith` - строка начинается с
- `endsWith` - строка заканчивается на
- `exists` - переменная существует
- `empty` - пустое значение

## Типы действий

### 1. Goto (Переход на сцену)
```javascript
{
  type: 'goto',
  target: 'death/suffocation'        // ID сцены из JSON
}
```

### 2. Set Variable (Установить переменную)
```javascript
{
  type: 'setVariable',
  path: 'game.toxic_gas',
  value: 1
}
```

### 3. Notification (Уведомление)
```javascript
{
  type: 'notification',
  text: '⚠️ Опасность!',
  notificationType: 'warning',      // 'warning', 'danger', 'success', 'info'
  duration: 3000
}
```

### 4. Dialogue (Диалог)
```javascript
{
  type: 'dialogue',
  character: 'mc',
  text: 'Мне плохо...'
}
```

### 5. Log (Логирование в консоль)
```javascript
{
  type: 'log',
  message: 'Debug информация'
}
```

### 6. Callback (Кастомный callback)
```javascript
{
  type: 'callback',
  callback: (gameState) => {
    // Ваш код
  }
}
```

## Примеры использования

### Пример 1: Простое правило - маска и газ

```javascript
export const toxicGasRule = {
  id: 'toxic_gas_no_mask',
  name: 'Смерть от отравления',
  description: 'Без маски + токсичный газ = смерть',
  enabled: true,
  debounce: 500,

  conditions: [
    {
      type: 'equipment',
      field: 'mask',
      operator: 'ne',
      value: 'gasmask'
    },
    {
      type: 'variable',
      path: 'game.toxic_gas',
      operator: 'gte',
      value: 1
    },
    {
      type: 'story',
      field: 'isPlaying',
      operator: 'eq',
      value: true
    }
  ],

  actions: [
    {
      type: 'notification',
      text: '⚠️ Недостаток кислорода!',
      notificationType: 'danger',
      duration: 2000
    },
    {
      type: 'goto',
      target: 'death/suffocation'
    }
  ]
};
```

### Пример 2: Правило с кастомной логикой

```javascript
export const complexRule = {
  id: 'complex_condition',
  name: 'Сложное условие',
  enabled: true,

  conditions: [
    {
      type: 'custom',
      check: (gameState) => {
        const health = gameState.character?.mc?.health || 100;
        const isInFactory = gameState.game?.location === 'factory';
        const noMask = gameState.character?.mc?.equipment_slots?.mask !== 'gasmask';
        
        // Все три условия должны быть истинны
        return health < 50 && isInFactory && noMask;
      }
    }
  ],

  actions: [
    {
      type: 'dialogue',
      character: 'mc',
      text: 'Я умираю... нужна помощь!'
    }
  ]
};
```

### Пример 3: Правило с debounce и once

```javascript
export const oneTimeEvent = {
  id: 'first_death_warning',
  name: 'Первое предупреждение о смерти',
  enabled: true,
  once: true,                        // Выполнится только один раз
  debounce: 1000,

  conditions: [
    {
      type: 'character',
      field: 'health',
      operator: 'lt',
      value: 20
    }
  ],

  actions: [
    {
      type: 'notification',
      text: '💀 Будь осторожнее!',
      notificationType: 'danger',
      duration: 3000
    }
  ],

  onTriggered: (gameState) => {
    console.log('Игрок впервые приблизился к смерти');
  }
};
```

## Интеграция в Game.vue

```vue
<script setup>
import { onMounted, onBeforeUnmount } from 'vue';
import { useGameRules } from '@/composables/useGameRules';
import { allStoryRules } from '@/constants/storyRules';

const gameState = reactive({
  character: { ... },
  game: { ... },
  storyEngine: { ... }
});

const { registerRules, startRules, stopRules } = useGameRules(gameState);

onMounted(() => {
  // Регистрируем все правила
  registerRules(allStoryRules);
  
  // Запускаем проверку каждые 100ms
  startRules(100);
});

onBeforeUnmount(() => {
  stopRules();
});
</script>
```

## Флаги правил

### `enabled`
Включено ли правило. Отключённые правила пропускаются при проверке.

### `once`
Если `true` - правило выполнится максимум один раз, затем будет пропускаться.

### `debounce`
Минимальный интервал между срабатываниями в миллисекундах. Нужен для оптимизации, чтобы дорогие проверки не запускались слишком часто.

## Отладка

### Посмотреть статистику правил

```javascript
const { stats } = useGameRules(gameState);
console.log(stats.value);
```

### Вручную срабатить правило

```javascript
const { triggerRule } = useGameRules(gameState);
triggerRule('rule_id');
```

### Включить/отключить правило

```javascript
const { setRuleEnabled } = useGameRules(gameState);
setRuleEnabled('rule_id', false); // Отключить
setRuleEnabled('rule_id', true);  // Включить
```

## Порядок выполнения

1. Engine проверяет ВСЕ условия текущего правила
2. Если все условия истинны:
   - Проверяет `once` - был ли выполнен раньше
   - Проверяет `debounce` - когда было последнее выполнение
   - Если выполнить можно - выполняет все `actions` по порядку
   - Вызывает `onTriggered` callback (если есть)

## Лучшие практики

### ✅ Делайте
- Указывайте `debounce` для дорогих операций
- Используйте `once: true` для событий "один раз в игре"
- Давайте описательные имена правилам
- Логируйте важные события через actions с типом 'log'
- Группируйте связанные условия

### ❌ Избегайте
- Добавлять логику в JSON истории
- Создавать правила с пустым `conditions` (всегда срабатывают)
- На слишком частые `debounce` значения (производительность)
- Десятки условий в одном правиле (разбейте на несколько)

## Примеры реальных случаев

### Случай 1: Потеря предмета
```javascript
conditions: [
  { type: 'variable', path: 'inventory.flashlight', operator: 'empty', value: null }
],
actions: [
  { type: 'notification', text: '🔦 Фонарик потерян!' },
  { type: 'dialogue', character: 'mc', text: 'Где мой фонарик?!' }
]
```

### Случай 2: День-ночь цикл
```javascript
conditions: [
  { type: 'variable', path: 'game.time', operator: 'gte', value: 20 },
  { type: 'variable', path: 'game.time', operator: 'lt', value: 6 }
],
actions: [
  { type: 'setVariable', path: 'game.isDayTime', value: false }
]
```

### Случай 3: Достижение
```javascript
conditions: [
  { type: 'variable', path: 'character.mc.kills', operator: 'eq', value: 100 }
],
actions: [
  { type: 'notification', text: '🏆 Достижение разблокировано!' },
  { type: 'setVariable', path: 'achievements.killer', value: true }
],
once: true
```

## Расширение системы

Хотите добавить новый тип условия? Отредактируйте метод `evaluateCondition` в `gameRulesEngine.js`:

```javascript
case 'myCustomType':
  result = this.evaluateMyCustomType(operand, field, value);
  break;
```

## Файлы

- [services/gameRulesEngine.js](../services/gameRulesEngine.js) - Основной класс
- [composables/useGameRules.js](../composables/useGameRules.js) - Vue composable
- [constants/storyRules.js](../constants/storyRules.js) - Все правила игры
