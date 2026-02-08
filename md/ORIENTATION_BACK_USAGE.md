# Использование `orientation` и `back` для персонажей

## Описание

При отображении персонажа (тип `"show"`) теперь поддерживаются два новых параметра:
- **`orientation`** - направление, куда смотрит персонаж
- **`back`** - показывает ли персонаж спину

## Параметры

### `orientation`
**Тип:** `string`
**По умолчанию:** `"right"`
**Возможные значения:** `"left"`, `"right"`, и другие пользовательские значения

Определяет направление, в котором стоит персонаж. Добавляет класс `orientation-{value}` к элементу персонажа.

### `back`
**Тип:** `boolean`
**По умолчанию:** `false`

Указывает, показывает ли персонаж спину. При `true` добавляет класс `char-back` к элементу персонажа.

## Примеры использования

### Пример 1: Персонаж слева (лицом вправо)
```json
{
  "type": "show",
  "character": "mc",
  "orientation": "left",
  "back": false,
  "position": {"l": 20, "r": "auto"},
  "duration": 0.5
}
```

Результирующие классы:
- `char-mc`
- `orientation-left`

### Пример 2: Персонаж спиной (лицом вправо)
```json
{
  "type": "show",
  "character": "mc",
  "orientation": "right",
  "back": true,
  "position": {"r": 20, "l": "auto"},
  "duration": 0.5
}
```

Результирующие классы:
- `char-mc`
- `orientation-right`
- `char-back`

### Пример 3: По умолчанию (без параметров)
```json
{
  "type": "show",
  "character": "mc",
  "position": {"r": 20}
}
```

Результирующие классы:
- `char-mc`
- `orientation-right` (значение по умолчанию)

## Использование в CSS

### Смена спрайтов в зависимости от ориентации

```css
/* Персонаж смотрит влево */
.orientation-left .sprite-image._body {
  transform: scaleX(-1);
}

/* Персонаж смотрит вправо */
.orientation-right .sprite-image._body {
  transform: scaleX(1);
}
```

### Смена спрайтов в зависимости от back

```css
/* Спина персонажа */
.char-back .sprite-image._body {
  /* Используем другой спрайт или трансформацию */
  opacity: 0.8;
}
```

## Использование с изменением спрайтов

Если у вас есть разные файлы спрайтов для разных ориентаций и позиций, вы можете использовать эти классы с CSS `background-image` или динамически менять источник изображения через скрипт.

### Пример с CSS переменными

```css
.char-mc .sprite-image._body {
  content: var(--char-mc-body-image, url('images/mc-body.png'));
}

.char-mc.orientation-left .sprite-image._body {
  content: var(--char-mc-body-left, url('images/mc-body-left.png'));
}

.char-mc.char-back .sprite-image._body {
  content: var(--char-mc-body-back, url('images/mc-body-back.png'));
}
```

## Интеграция со скриптами

При необходимости вы можете использовать JavaScript для более сложной логики замены спрайтов:

```javascript
// Примечание: это примерный код, интеграция зависит от вашей архитектуры
character.orientation = 'left'
character.back = false
// Система автоматически добавит классы
```

## Заметки

- Классы добавляются автоматически при отображении персонажа
- Классы сохраняются до тех пор, пока персонаж видим на экране
- Можно комбинировать `orientation` с другими параметрами (`position`, `duration`, `class`)
- Все значения чувствительны к регистру
