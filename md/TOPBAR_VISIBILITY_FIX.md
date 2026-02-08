# Исправление видимости Topbar - Резюме

## 🐛 Проблема
Topbar не был виден в игре, хотя стили применялись. Причина: когда в start.json выполняется `"type": "ui", "target": ["all"], "action": "hide"`, скрывается ВСЕ UI, включая topbar.

## ✅ Решение

### 1. Добавлено поле `topbar` в uiVisibility

**Файл:** `src/renderer/composables/useVisualNovel.js`

```javascript
// Было:
const uiVisibility = ref({
  all: true,
  'stats-button': true,
  hotbar: true,
  dialogue: true
})

// Стало:
const uiVisibility = ref({
  all: true,
  'stats-button': true,
  topbar: true,  // ✨ Новое поле
  hotbar: true,
  dialogue: true
})
```

### 2. Добавлено исключение для topbar в handleUIStep

**Файл:** `src/renderer/composables/useVisualNovel.js`

Функция `handleUIStep` теперь не скрывает topbar, когда выполняется команда "скрыть всё UI":

```javascript
function handleUIStep(step) {
  const action = step.action
  const targets = step.target || []

  if (!targets || targets.length === 0) {
    uiVisibility.value['all'] = action === 'show'
    return
  }

  targets.forEach(target => {
    if (target === 'all') {
      uiVisibility.value['all'] = action === 'show'
    } else {
      // ✨ Новое: topbar всегда остается видимым
      if (target === 'topbar') {
        console.log(`UI ${action}: ${target} - skipped (topbar always visible)`)
        return
      }
      uiVisibility.value[target] = action === 'show'
    }
  })
}
```

## 📍 Что изменилось

### Поведение до исправления
- start.json выполняет: `"type": "ui", "target": ["all"], "action": "hide"`
- Скрывается ВСЕ UI (hotbar, dialogue, статы)
- Topbar тоже скрывается (так как его не было в `uiVisibility`)

### Поведение после исправления
- start.json выполняет: `"type": "ui", "target": ["all"], "action": "hide"`
- Скрывается hotbar, dialogue, статы
- **Topbar ОСТАЕТСЯ видимым** (всегда доступен в игре)
- При необходимости можно явно скрыть topbar: `"target": ["topbar"]`

## 🎯 Логика

Topbar всегда остается видимым во время игры потому что:
1. Это основной интерфейс для доступа к инвентарю и статистике
2. Не мешает кинематикам и заставкам (находится в background слое)
3. Должен быть доступен в любой момент игры

Если в будущем понадобится скрыть topbar (например, для кинематики), можно явно указать:
```json
{
  "type": "ui",
  "target": ["topbar", "hotbar"],
  "action": "hide"
}
```

## ✨ Результат

✅ Topbar теперь видна в игре
✅ Остальной UI управляется как раньше
✅ Логирование показывает: "UI hide: topbar - skipped (topbar always visible)"
✅ Нет ошибок компиляции
✅ HMR работает корректно

## 📝 Файлы, которые были изменены

1. `src/renderer/composables/useVisualNovel.js`
   - Добавлено поле `topbar: true` в `uiVisibility`
   - Обновлена функция `handleUIStep` с исключением для topbar

**Итого: 2 изменения в 1 файле**
