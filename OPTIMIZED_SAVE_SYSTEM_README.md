# Оптимизированная система сохранения/загрузки игры

## Обзор

Система сохранения была оптимизирована для уменьшения размера файлов сохранений. Вместо сохранения полного состояния персонажей со всеми дефолтными значениями и спрайтами, теперь сохраняется только **дельта** (изменения от дефолтных значений).

## Проблема

**До оптимизации:**
- Файл сохранения содержал полное состояние `characterData` с:
  - Всеми параметрами персонажа (многие из них не изменяются)
  - Полными объектами `sprites` (большие объекты с путями к изображениям)
  - Полным объектом `equipment` (список всех доступных предметов)
  - Полным объектом `equipmentBySlot` (состояние экипировки)
- Размер файла сохранения: ~460 строк JSON (461 line count в примере)
- Много дублирования данных (sprites, equipment одинаковые для всех сохранений персонажа)

## Решение

**После оптимизации:**
- Сохраняется только `characterDataDelta` - только **изменившиеся значения**
- Спрайты, оборудование и другие статические объекты НЕ сохраняются (загружаются из файлов)
- При загрузке:
  1. Загружаются дефолтные данные персонажей (спрайты, оборудование)
  2. Поверх них накладываются изменения из сохранения
  3. Результат - полное состояние игры

## Архитектура

### Утилиты: `saveGameUtils.js`

```javascript
// Извлечение только измененных значений
extractDelta(current, defaults, excludeKeys)

// Извлечение дельты для всех персонажей
extractCharacterDataDelta(characterData, characterDefaults)

// Слияние дельты с дефолтами
mergeDeltaWithDefaults(defaults, delta)

// Слияние данных всех персонажей
mergeCharacterDataWithDefaults(characterDefaults, characterDataDelta)

// Создание снимка дефолтных значений
createCharacterDefaults(characterData)
```

### Хранилище: `saves.js`

```javascript
// Установка дефолтных значений персонажей (вызывается при загрузке персонажей)
setCharacterDefaults(characterData)

// Сохранение только дельты вместо полных данных
serializeGameState(gameState)
// Возвращает: characterDataDelta (вместо characterData)
```

### Компонент: `VisualNovel.vue`

```javascript
// При загрузке персонажей - устанавливаем дефолты
savesStore.setCharacterDefaults(characterData.value)

// При восстановлении - применяем дельту на дефолты
if (saveData.characterDataDelta) {
  Object.assign(characterData.value[characterId], saveData.characterDataDelta[characterId])
}
```

## Пример

### Старое сохранение (полное)

```json
{
  "gameState": {
    "characterData": {
      "mc": {
        "id": "mc",
        "name": "Ренат",
        "size": 1,
        "race": "human",
        "gender": "male",
        "hpmax": 10,
        "mpmax": 10,
        "attack": 3,  // ← Изменено с 2
        "defense": 1,
        "weight": 60,
        "hp": 10,
        "mp": 10,
        "lvl": 1,
        "exp": 0,
        "skill_points": 0,
        "stat_points": 0,
        "fractions": [],
        "tags": ["gamer", "noob"],
        "equipment_slots": { ... },  // 11 слотов
        "sprites": { ... }  // Большой объект с 10+ спрайтами
      }
    }
  }
}
// ~460 строк JSON
```

### Новое сохранение (дельта)

```json
{
  "gameState": {
    "characterDataDelta": {
      "mc": {
        "name": "Ренат",  // ← Только изменения
        "attack": 3
      }
    }
  }
}
// ~10 строк JSON (95% меньше!)
```

## Процесс сохранения

1. **Загрузка персонажей** (один раз при запуске):
   ```javascript
   // VisualNovel.vue
   characterData.value = { /* полные данные со спрайтами */ }
   savesStore.setCharacterDefaults(characterData.value)
   // Сохраняются дефолты для сравнения
   ```

2. **Сохранение игры** (по команде пользователя):
   ```javascript
   // saves.js - serializeGameState()
   const characterDataDelta = extractCharacterDataDelta(
     gameState.characterData,        // Текущие значения
     characterDefaults.value         // Дефолтные значения
   )
   // Сохраняется только дельта (что изменилось)
   ```

3. **Загрузка игры** (по команде пользователя):
   ```javascript
   // 1. Загружаются дефолты (персонажи, сцены, спрайты)
   await loadStory()
   characterData.value = { /* полные данные со спрайтами */ }
   
   // 2. Применяется дельта из сохранения
   Object.assign(characterData.value[charId], saveData.characterDataDelta[charId])
   // Результат - полное состояние с измененными значениями
   ```

## Исключенные поля

Следующие поля **никогда** не сохраняются (всегда загружаются из файлов):

- `sprites` - определение спрайтов персонажа
- `equipment` - список всех доступных предметов
- `equipmentBySlot` - текущее состояние экипировки (но данные о том, какие предметы экипированы, сохраняются в `equipment_slots`)

## Обратная совместимость

Система автоматически обрабатывает старые сохранения (которые используют `characterData` вместо `characterDataDelta`):

```javascript
// В VisualNovel.vue
// Handle legacy save files that use full characterData instead of delta
if (saveData.characterData && !saveData.characterDataDelta) {
  console.warn('⚠ Loading legacy save file with full character data (not optimized)')
  Object.assign(characterData.value[characterId], saveData.characterData[characterId])
}
```

## Результаты оптимизации

- ✅ **Размер файла**: 460 строк → ~20 строк (95% сокращение)
- ✅ **Скорость**: Быстрее читать/писать меньше данных
- ✅ **Хранение**: Экономия дискового пространства
- ✅ **Совместимость**: Старые сохранения всё ещё работают
- ✅ **Чистота**: Дефолты и изменения логически разделены

## Файлы

- `utils/saveGameUtils.js` - утилиты для работы с дельтой
- `stores/saves.js` - хранилище сохранений с поддержкой дельты
- `components/game/VisualNovel.vue` - логика загрузки и восстановления
