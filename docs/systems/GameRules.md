# Game Rules Engine (Система условной логики)

**Game Rules Engine** — это независимая система управления условиями и действиями в игре. Вместо "хардкода" условий в JSON-истории, правила живут в JS-файлах.

## Архитектура
1. `services/gameRulesEngine.js`: Основной класс (регистрация, проверка, выполнение, статистика).
2. `composables/useGameRules.js`: Vue Composable для компонентов.
3. `constants/storyRules.js`: Конфигурационный файл со всеми правилами.

## Структура правила

```javascript
{
  id: 'toxic_gas_no_mask',
  name: 'Смерть от отравления',
  description: 'Без маски + токсичный газ = смерть',
  enabled: true,
  once: false,       // Выполнить максимум один раз
  debounce: 500,     // Минимальный интервал между выполнениями (мс)
  
  conditions: [      // ВСЕ условия должны быть выполнены (И / AND)
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
    }
  ],
  
  actions: [         // Что сделать, если условия истинны
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
}
```

## Типы условий (`type`)
- `variable` (проверка `gameState.game.some_var` или `gameState.character.mc.some_var`)
- `equipment` (проверка надетых предметов)
- `location` (проверка локации)
- `story` (состояние воспроизведения истории)
- `character` (состояние персонажа)
- `custom` (кастомная функция `check: (gameState) => boolean`)

### Операторы
`eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `nin`, `contains`, `startsWith`, `endsWith`, `exists`, `empty`.

## Типы действий (`type`)
- `goto`: Переход на сцену JSON
- `setVariable`: Установка переменной в `gameState`
- `notification`: Всплывающее уведомление UI
- `dialogue`: Запуск короткого диалога
- `log`: Запись в консоль
- `callback`: Кастомная функция `callback: (gameState) => { ... }`

## Подключение в Vue

```vue
<script setup>
import { onMounted, onBeforeUnmount } from 'vue';
import { useGameRules } from '@/composables/useGameRules';
import { allStoryRules } from '@/constants/storyRules';

// Получаем ссылку на глобальный стейт
const { registerRules, startRules, stopRules } = useGameRules(gameState);

onMounted(() => {
  registerRules(allStoryRules);
  startRules(100); // Запуск цикла проверки каждые 100мс
});

onBeforeUnmount(() => {
  stopRules();
});
</script>
```

> [!TIP]
> Указывайте разумный `debounce` (например, 500 или 1000) для "тяжёлых" или часто проверяемых правил.
