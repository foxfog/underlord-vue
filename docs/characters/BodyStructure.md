# Структура персонажа (body.json) - Полный гайд

## Файл структуры

Структура каждого персонажа описана в файле `body.json`:
`src/renderer/public/data/characters/{character_id}/body.json`

Например, для главного героя:
`src/renderer/public/data/characters/mc/body.json`

## Основная структура

```json
{
  "part_name": {
    "image": "images/sprites/characters/{character_id}/{part_name}.png",
    "parent": "parent_part_name",
    "zindex": 0,
    "offset": {
      "x": 0.5,
      "y": -50.75
    }
  }
}
```

## Поля в JSON

### `image` (обязательно)
Путь к файлу изображения спрайта.
```json
"image": "images/sprites/characters/mc/head.png"
```

### `parent` (опционально)
ID части тела, к которой крепится текущая часть. Образует иерархию.
- `"parent": "body"` (крепится к body)
- `"parent": "neck"` (крепится к neck)

**Если `parent` не указан** — часть крепится к корню персонажа (обычно это body).

### `zindex` (опционально, рекомендуется)
Порядок отрисовки части. Подробности см. в файле [ZIndex.md](./ZIndex.md).
- **-1**: Позади других частей (например, правая рука)
- **0**: Обычный порядок (по умолчанию)
- **1**: Поверх других частей (например, волосы)

### `offset` (опционально)
Смещение части тела относительно родителя в процентах от высоты/ширины спрайта.
```json
"offset": {
  "x": -41.99,
  "y": -43
}
```

**Координатная система:**
- `x` положительное → вправо
- `x` отрицательное → влево
- `y` положительное → вниз
- `y` отрицательное → вверх

## Пример сложной структуры с цепочками

```json
{
  "body": { "image": "..." },
  "neck": { 
    "image": "...",
    "parent": "body"
  },
  "head": { 
    "image": "...",
    "parent": "neck"
  },
  "arm_left": { 
    "image": "...",
    "parent": "body"
  },
  "arm_left2": { 
    "image": "...",
    "parent": "arm_left"
  },
  "arm_right": { 
    "image": "...",
    "parent": "body",
    "zindex": -1
  }
}
```

## Как это работает в компоненте Vue

Компоненты `Character.vue` и `SpritePart.vue` рекурсивно выстраивают персонажа:
1. `Character.vue` группирует части по `parent`.
2. `SpritePart.vue` рекурсивно отрисовывает себя и дочерние части.
3. Ко всем элементам применяются `offset` и `zindex`.
