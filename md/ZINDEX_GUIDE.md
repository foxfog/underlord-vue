# Z-Index для частей тела персонажа

## Описание

Свойство `zindex` (или `z-index`) определяет порядок наложения частей тела персонажа. Это необходимо когда части тела перекрывают друг друга и нужно контролировать какая часть находится спереди.

## Синтаксис

В JSON файле части тела используйте `zindex` (без дефиса):

```json
{
  "part_name": {
    "image": "path/to/image.png",
    "parent": "parent_part",
    "zindex": -1,
    "offset": {
      "x": 0,
      "y": 0
    }
  }
}
```

**Или альтернативный синтаксис с дефисом:**
```json
{
  "part_name": {
    "z-index": -1
  }
}
```

Оба синтаксиса поддерживаются компонентом!

## Значения

- **Положительные значения** (1, 2, 10) - части находятся поверх остальных
- **Ноль** (0, или отсутствие свойства) - обычный порядок (значение по умолчанию)
- **Отрицательные значения** (-1, -2) - части находятся под остальными

## Примеры

### Пример 1: Рука позади туловища
```json
{
  "arm_right": {
    "image": "images/sprites/characters/mc/arm_right.png",
    "parent": "body",
    "zindex": -1,
    "offset": {
      "x": -19.2,
      "y": -43
    }
  }
}
```

Рука будет отрисована позади тела (так как это обычно требуется для задней руки).

### Пример 2: Волосы поверх головы
```json
{
  "hair": {
    "image": "images/sprites/characters/mc/hair.png",
    "parent": "head",
    "zindex": 1,
    "offset": {
      "x": 0,
      "y": -5
    }
  }
}
```

Волосы будут отрисованы поверх головы.

### Пример 3: Без явного z-index
```json
{
  "neck": {
    "image": "images/sprites/characters/mc/neck.png",
    "parent": "body",
    "offset": {
      "x": 0,
      "y": -50.75
    }
  }
}
```

Будет использован z-index 0 (обычный порядок в иерархии).

## Как это работает в коде

В компоненте `SpritePart.vue` есть вычисляемое свойство `offsetStyle`:

```javascript
const offsetStyle = computed(() => {
  const style = {}
  
  // Смещения
  if (props.sprite.offset) {
    if (props.sprite.offset.x !== undefined) {
      style.left = `${props.sprite.offset.x}%`
    }
    if (props.sprite.offset.y !== undefined) {
      style.top = `${props.sprite.offset.y}%`
    }
  }
  
  // Z-index (может быть zindex или z-index в JSON)
  if (props.sprite.zindex !== undefined) {
    style.zIndex = props.sprite.zindex
  } else if (props.sprite['z-index'] !== undefined) {
    style.zIndex = props.sprite['z-index']
  }
  
  return style
})
```

## Поддерживаемые синтаксисы

| Синтаксис | Работает? | Примечание |
|----------|----------|-----------|
| `"zindex": -1` | ✅ | Рекомендуется |
| `"z-index": -1` | ✅ | Альтернатива |

Оба синтаксиса работают благодаря коду в компоненте!

## Практический пример из проекта

```json
{
  "body": {
    "image": "images/sprites/characters/mc/body.png"
  },
  "arm_left": {
    "image": "images/sprites/characters/mc/arm_left.png",
    "parent": "body"
  },
  "arm_right": {
    "image": "images/sprites/characters/mc/arm_right.png",
    "parent": "body",
    "zindex": -1
  }
}
```

**Результат:**
- `body` - z-index 0 (фон)
- `arm_left` - z-index 0 (по умолчанию, отрисуется после body)
- `arm_right` - z-index -1 (позади всех, отрисуется первым)

Порядок отрисовки: `arm_right` → `body` → `arm_left`

## Советы

1. **Используйте `zindex` (без дефиса)** - более конситентно с JSON синтаксисом
2. **Правая рука обычно позади** - используйте `zindex: -1`
3. **Левая рука обычно спереди** - не указывайте zindex или используйте `zindex: 0`
4. **Волосы могут быть спереди** - используйте `zindex: 1`
5. **Помните про иерархию** - родительская часть влияет на отрисовку дочерних

## Ошибки и исправления

**Ошибка:** Z-index не применяется
```json
{
  "arm_right": {
    "z-index": -1  // ❌ Может не работать в старых версиях
  }
}
```

**Исправление:** Используйте `zindex`
```json
{
  "arm_right": {
    "zindex": -1  // ✅ Работает гарантированно
  }
}
```

---

**Последнее обновление:** 19 февраля 2026  
**Поддержка:** ✅ Оба синтаксиса поддерживаются
