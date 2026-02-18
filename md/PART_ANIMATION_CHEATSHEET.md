# Шпаргалка: Анимация частей тела (Part Animation)

## Быстрый старт

### Встряхивание головы при кашле
```json
{
  "type": "voice",
  "file": "audio/voice/man_cough.mp3"
},
{
  "type": "part-animate",
  "character": "mc",
  "part": "head",
  "class": "shake-head",
  "duration": 0.5
}
```

### Плавное движение вниз на 5%
```json
{
  "type": "part-animate",
  "character": "mc",
  "part": "head",
  "styles": {
    "transform": "translateY(5%)",
    "transition": "transform 0.5s ease-in-out"
  },
  "duration": 0.5
}
```

### Дрожание тела
```json
{
  "type": "part-animate",
  "character": "mc",
  "part": "body",
  "class": "tremble",
  "duration": 1.5
}
```

## Встроенные классы

| Класс | Эффект | Пример |
|-------|--------|--------|
| `shake-head` | Встряхивание вверх-вниз (2 раза) | Кашель, удар |
| `tremble` | Дрожание в стороны | Холод, страх |
| `pulse` | Пульсирование (масштабирование) | Биение сердца |

## Параметры шага

```json
{
  "type": "part-animate",
  "character": "имя_персонажа",    // Обязательно
  "part": "название_части",        // Обязательно (head, body, hand_left и т.д.)
  
  // Вариант 1: Прямые стили
  "styles": {                       // CSS свойства
    "transform": "translateY(5%)",
    "transition": "transform 0.5s ease-in-out"
  },
  
  // Вариант 2: Класс
  "class": "shake-head",            // CSS класс из character.css
  
  "duration": 0.5                   // Секунды (опционально)
}
```

## CSS трансформы

### Переместить
```json
"transform": "translateX(10%)"    // Вправо на 10%
"transform": "translateY(5%)"     // Вниз на 5%
"transform": "translate(10%, 5%)" // Вправо и вниз
```

### Повернуть
```json
"transform": "rotate(15deg)"      // Поворот на 15°
"transform": "rotate(-10deg)"     // Против часовой стрелки
```

### Масштабировать
```json
"transform": "scale(1.1)"         // На 10% больше
"transform": "scaleX(0.8)"        // Сжать по горизонтали
"transform": "scaleY(1.2)"        // Растянуть по вертикали
```

### Комбинированные
```json
"transform": "translateY(5%) rotate(10deg) scale(1.05)"
```

## Easing функции для transition

```json
"transition": "transform 0.5s ease-in-out"     // Плавный старт и конец
"transition": "transform 0.5s linear"          // Линейный
"transition": "transform 0.5s ease-in"         // Ускорение
"transition": "transform 0.5s ease-out"        // Замедление
"transition": "transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)" // Отскок
```

## Типичные сценарии

### Кашель (встряхивание головы)
```json
{
  "type": "voice",
  "file": "audio/voice/cough.mp3"
},
{
  "type": "part-animate",
  "character": "mc",
  "part": "head",
  "class": "shake-head",
  "duration": 0.5
},
{
  "type": "dialogue",
  "character": "mc",
  "text": "<p>[кашель]</p>"
}
```

### Боль (встряхивание + склонение головы)
```json
{
  "type": "part-animate",
  "character": "mc",
  "part": "head",
  "styles": {
    "transform": "rotate(-15deg) translateY(-10%)",
    "transition": "transform 0.4s ease-in-out"
  },
  "duration": 0.4
}
```

### Дрожание от холода
```json
{
  "type": "part-animate",
  "character": "mc",
  "part": "body",
  "class": "tremble",
  "duration": 1.5
}
```

### Сложное движение
```json
{
  "type": "part-animate",
  "character": "mc",
  "part": "hand_right",
  "styles": {
    "transform": "rotate(30deg) translateY(-20%)",
    "opacity": "0.7",
    "transition": "all 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)"
  },
  "duration": 0.6
}
```

## Названия частей тела

Используйте в параметре `part`:
- `head` — голова
- `body` — туловище
- `arm_left` или `hand_left` — левая рука
- `arm_right` или `hand_right` — правая рука
- `leg_left` — левая нога
- `leg_right` — правая нога

*(Точные названия зависят от структуры персонажа в `character-data.json`)*

## Отладка

### Посмотреть в консоли что происходит
Все операции логируются с префиксом 🎬:
```
🎬 [mc] Part animation: part=head, class=shake-head, duration=0.5s
🎬 [mc] Part animation cleared: part=head
```

### Проверить структуру персонажа
В консоли разработчика:
```javascript
// В Vue components:
console.log(characterData.value.mc.partAnimations)
```
