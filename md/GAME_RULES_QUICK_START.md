# Game Rules Engine - Быстрый старт

## 3 мин на 3 шага

### Шаг 1: Добавьте импорты в Game.vue

```javascript
import { useGameRules } from '@/composables/useGameRules'
import { allStoryRules } from '@/constants/storyRules'
```

### Шаг 2: Инициализируйте в onMounted

```javascript
const { registerRules, startRules, stopRules } = useGameRules(gameState)

onMounted(() => {
	registerRules(allStoryRules)
	startRules(100)  // Проверяем каждые 100ms
})

onBeforeUnmount(() => {
	stopRules()
})
```

### Шаг 3: Добавьте новое правило в storyRules.js

```javascript
export const myNewRule = {
	id: 'my_rule',
	name: 'Название правила',
	description: 'Что оно делает',
	enabled: true,
	debounce: 500,

	conditions: [
		{ type: 'equipment', field: 'mask', operator: 'ne', value: 'gasmask' },
		{ type: 'variable', path: 'game.toxic_gas', operator: 'gte', value: 1 }
	],

	actions: [
		{ type: 'notification', text: '⚠️ Опасность!' },
		{ type: 'goto', target: 'death/suffocation' }
	]
}

// Добавьте в allStoryRules
export const allStoryRules = [
	toxicGasRule,
	myNewRule,  // ← ваше новое правило
	// ...
]
```

## Главные концепции

### Правило = Условия + Действия

```
ЕСЛИ (все условия истинны)
  ТО выполни все действия
```

### Условие

```javascript
{
	type: 'equipment',        // тип проверки
	field: 'mask',            // что проверяем
	operator: 'ne',           // оператор
	value: 'gasmask'          // ожидаемое значение
}
```

**Типы:** `variable`, `equipment`, `location`, `story`, `character`, `custom`

**Операторы:** `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `contains`, `startsWith`, ...

### Действие

```javascript
{
	type: 'goto',         // тип действия
	target: 'death/...'   // параметры
}
```

**Типы:** `goto`, `setVariable`, `notification`, `dialogue`, `log`, `callback`

## Примеры

### Если маска не надета + токсичный газ → смерть

```javascript
{
	id: 'toxic_no_mask',
	conditions: [
		{ type: 'equipment', field: 'mask', operator: 'ne', value: 'gasmask' },
		{ type: 'variable', path: 'game.toxic_gas', operator: 'gte', value: 1 }
	],
	actions: [
		{ type: 'goto', target: 'death/suffocation' }
	]
}
```

### Если здоровье < 50% → красное предупреждение

```javascript
{
	id: 'low_health',
	conditions: [
		{ type: 'character', field: 'health', operator: 'lt', value: 50 }
	],
	actions: [
		{ type: 'notification', text: '🚨 Здоровье критически низко!' }
	],
	debounce: 2000  // Не чаще чем раз в 2 сек
}
```

### Если на фабрике → показать диалог

```javascript
{
	id: 'factory_arrival',
	conditions: [
		{ type: 'location', field: 'current', operator: 'eq', value: 'factory' }
	],
	actions: [
		{ type: 'dialogue', character: 'mc', text: 'Здесь очень опасно....' }
	],
	once: true  // Показать только один раз
}
```

### Кастомная логика

```javascript
{
	id: 'complex',
	conditions: [
		{
			type: 'custom',
			check: (gameState) => {
				const health = gameState.character?.mc?.health || 100
				const noMask = gameState.character?.mc?.equipment_slots?.mask !== 'gasmask'
				return health < 30 && noMask
			}
		}
	],
	actions: [
		{ type: 'notification', text: '💀 Умираю без маски!' }
	]
}
```

## Флаги

- `enabled: true/false` - Включить/отключить правило
- `once: true` - Выполнить максимум один раз
- `debounce: 500` - Не срабатывать чаще чем раз в 500ms
- `onTriggered: (gameState) => { ... }` - Callback когда правило срабатывает

## Полезные методы

```javascript
const { 
	registerRules,      // Зарегистрировать правила
	startRules,         // Запустить проверку (100ms по умолчанию)
	stopRules,          // Остановить проверку
	stats,              // ref с статистикой правил
	setRuleEnabled,     // Включить/отключить правило
	triggerRule,        // Вручную срабатить правило
	getAllRules         // Получить все правила
} = useGameRules(gameState)

// Использование:
setRuleEnabled('toxic_no_mask', false)  // Отключить правило
triggerRule('my_rule')                   // Вручную запустить
console.log(stats.value)                 // Посмотреть статистику
```

## Файлы

- 📄 [services/gameRulesEngine.js](../services/gameRulesEngine.js) - Основной класс
- 🪝 [composables/useGameRules.js](../composables/useGameRules.js) - Composable для Vue
- 📋 [constants/storyRules.js](../constants/storyRules.js) - Все правила игры
- 📖 [GAME_RULES_ENGINE.md](GAME_RULES_ENGINE.md) - Полная документация
- 🔧 [GAME_RULES_INTEGRATION_EXAMPLE.md](GAME_RULES_INTEGRATION_EXAMPLE.md) - Примеры интеграции

## Отладка

```javascript
// Посмотреть какие правила срабатывают
console.log(stats.value)

// Слушать консоль браузера:
// ✓ Срабатывает правило: toxic_gas_no_mask
// 📝 Переменная установлена: game.toxic_gas = 1

// Включить режим отладки (добавьте в gameRulesEngine.js)
const DEBUG = true;  // в методе executeRule

// Тестировать правило вручную
triggerRule('rule_id')
```

## Лучшие практики

✅ **Делайте:**
- Давайте описательные названия: `toxic_gas_no_mask`
- Указывайте `debounce` для дорогих операций
- Используйте `once: true` для событий "один раз в игре"
- Группируйте связанные условия

❌ **Избегайте:**
- Добавлять логику в JSON истории
- Пустой массив `conditions` (будет срабатывать всегда)
- Слишком частый `debounce` (нагрузка на производительность)
- 20+ условий в одном правиле (разбейте на несколько)

## Примеры нескольких условий

```javascript
// ВСЕ условия должны быть истинны (AND)
conditions: [
	{ type: 'equipment', field: 'mask', operator: 'ne', value: 'gasmask' },  // ❌ маска
	{ type: 'variable', path: 'game.toxic_gas', operator: 'gte', value: 1 }  // ✓ газ есть
	// => Правило сработает только если оба условия истинны
]

// Для ИЛИ логики (OR) используйте несколько правил:
// Правило 1: если маска нет И газ есть → смерть
// Правило 2: если здоровье < 20 И газ есть → смерть
```

## Система состоит из

### 1. GameRulesEngine (Сервис)
- Проверяет условия
- Выполняет действия
- Отслеживает статистику
- ~400 строк, хорошо документирован

### 2. useGameRules (Composable)
- Удобная работа с engine из Vue компонентов
- Управление включением/отключением правил
- ~100 строк

### 3. storyRules.js (Конфиг)
- Все правила игры в одном файле
- Легко добавлять новые
- Каждое правило - это объект

## Для опытных

Если нужны сложные условия, используйте `type: 'custom'`:

```javascript
{
	type: 'custom',
	check: (gameState) => {
		const mc = gameState.character?.mc
		const game = gameState.game

		// Сложная логика
		if (mc.health < 50 && game.location === 'factory' && !mc.equipment_slots.mask) {
			// Проверка на какие-то предметы в инвентаре
			return mc.inventory.some(item => item.type === 'antidote')
		}
		return false
	}
}
```

## Часто задаваемые вопросы

**Q: Как проверить есть ли предмет в инвентаре?**
A: Используйте `type: 'custom'` и проверьте `gameState.character.mc.inventory`

**Q: Как изменить переменную?**
A: `{ type: 'setVariable', path: 'game.toxic_gas', value: 0 }`

**Q: Как получить одну переменную?**
A: `gameState.game.toxic_gas` или через условие

**Q: Когда проверяются правила?**
A: Каждые 100ms (по умолчанию) + когда вызовете updateGameState()

**Q: Можно ли использовать выражения?**
A: Используйте `type: 'custom'` для сложной логики

---

**Готовы? Смотрите примеры в [GAME_RULES_ENGINE.md](GAME_RULES_ENGINE.md)**
