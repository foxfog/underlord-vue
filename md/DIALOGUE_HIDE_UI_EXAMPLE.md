# Пример: Система скрытия UI при диалоге

## Глобальная конфигурация

Вся конфигурация находится в одном месте. Отредактируйте этот файл один раз и готово!

### Шаг 1: Откройте файл конфигурации

**Файл:** `src/renderer/constants/dialogue.js`

```javascript
/**
 * Глобальная конфигурация для системы скрытия UI при диалоге
 * Эти элементы будут скрыты при активном диалоге независимо от истории
 */
export const DIALOGUE_HIDE_UI_CONFIG = [
	'hotbar',
	'map-button'
]
```

### Шаг 2: Отредактируйте массив

Добавьте или удалите элементы:

```javascript
export const DIALOGUE_HIDE_UI_CONFIG = [
	'hotbar',
	'map-button',
	'stats-button'  // ← добавили
]
```

### Шаг 3: Готово! ✅

Теперь при любом диалоге будут скрыты: hotbar, map-button, stats-button.

## Примеры конфигурации

### Вариант 1: Скрыть несколько элементов

```javascript
export const DIALOGUE_HIDE_UI_CONFIG = [
	'hotbar',
	'map-button',
	'stats-button'
]
```

### Вариант 2: Скрыть всё кроме диалога (кинематик)

```javascript
export const DIALOGUE_HIDE_UI_CONFIG = ['all']
```

### Вариант 3: Не скрывать ничего

```javascript
export const DIALOGUE_HIDE_UI_CONFIG = []
```

### Вариант 4: Скрыть только нижнюю панель

```javascript
export const DIALOGUE_HIDE_UI_CONFIG = ['hotbar']
```

## Как это выглядит в игре

### До добавления конфигурации:
```
[Stats] [Inventory] [Map]     ← Видны при диалоге
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Диалог текст...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Item] [Item] [Item] [Item]   ← Видны при диалоге
```

### После добавления конфигурации с `['hotbar', 'map-button']`:
```
[Stats] [Inventory]           ← [Map] скрыта!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Диалог текст...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                              ← [Hotbar] скрыта!
```

### После закрытия диалога:
```
[Stats] [Inventory] [Map]     ← Всё вернулось!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Item] [Item] [Item] [Item]   ← Всё вернулось!
```

## Проверка в DevTools

### Что проверить:

```javascript
// В консоли браузера (F12):

// 1. Текущая конфигурация:
visualNovel.value.uiVisibility.dialogueHideUI
// ["hotbar", "map-button"]

// 2. Активен ли диалог:
visualNovel.value.uiVisibility.hasDialogue
// true при диалоге, false без диалога

// 3. Текущее состояние всех элементов:
visualNovel.value.uiVisibility
// {
//   all: false,
//   'stats-button': false,
//   'inventory-button': false,
//   'map-button': false,      ← false = скрыт
//   topbar: false,
//   hotbar: false,            ← false = скрыт
//   dialogue: false,
//   dialogueHideUI: ['hotbar', 'map-button'],
//   hasDialogue: true
// }
```

## Что изменилось в коде

### Добавлено:
1. **Новый файл:** `src/renderer/constants/dialogue.js` с конфигурацией
2. **В useVisualNovel.js:**
   - Импорт `DIALOGUE_HIDE_UI_CONFIG`
   - Использование при инициализации `dialogueHideUI`

### Удалено:
1. Шаг `"type": "dialogue-hide-config"` из JSON (больше не нужен)
2. Обработка этого шага в `processStep()`

### Осталось:
1. Функция `setDialogueHideUI()` — для динамического изменения если надо
2. Функции `applyDialogueHiding()` и `clearDialogueHiding()` — для применения

## FAQ

**Q: Где находится конфиг?**
A: В файле `src/renderer/constants/dialogue.js`

**Q: Нужно ли менять JSON сценария?**
A: Нет! Конфигурация глобальная и применяется ко всем историям.

**Q: Как сделать разную конфигурацию для разных историй?**
A: Используйте `visualNovel.value.setDialogueHideUI([...])` из кода, когда переключаетесь между историями. Или создайте константы для разных режимов.

**Q: Сохраняется ли конфиг?**
A: Нет, конфигурация глобальна и не зависит от сохранений.

**Q: Что если я явно скрыл элемент через UI команду?**
A: Он останется скрыт даже после диалога, потому что система диалог-скрытия не переопределяет явное скрытие.

**Q: Можно ли менять конфиг во время игры?**
A: Да, вызовите `visualNovel.value.setDialogueHideUI(['новый', 'конфиг'])`. Но при загрузке новой истории вернётся к дефолту из `DIALOGUE_HIDE_UI_CONFIG`.

## Полезные команды для отладки

```javascript
// Текущая конфигурация:
console.log(visualNovel.value.uiVisibility.dialogueHideUI)

// Активен ли диалог:
console.log('Диалог активен:', visualNovel.value.uiVisibility.hasDialogue)

// Все элементы UI:
console.table(visualNovel.value.uiVisibility)

// Изменить конфиг на лету:
visualNovel.value.setDialogueHideUI(['hotbar', 'stats-button', 'inventory-button'])

// Отключить скрытие:
visualNovel.value.setDialogueHideUI([])

// Скрыть всё:
visualNovel.value.setDialogueHideUI(['all'])
```

## Рекомендации

- **Начните просто:** Установите только самые нужные элементы
- **Тестируйте:** Откройте DevTools и проверьте `hasDialogue`
- **Используйте константу:** Не вписывайте конфиг в истории
- **Документируйте:** Если вам нужна разная конфигурация для разных мест — добавьте комментарии

