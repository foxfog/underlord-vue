# Анимация частей тела персонажа (Part Animation)

## Описание

Система анимации частей тела позволяет применять анимации к отдельным частям персонажа (head, body, arms и т.д.) двумя способами:

1. **Прямые стили** — задание CSS свойств напрямую в шаге
2. **Через класс** — применение предопределённого класса с автоматической длительностью анимации

## Синтаксис

### Способ 1: Прямые стили

```json
{
  "type": "part-animate",
  "character": "mc",
  "part": "head",
  "styles": {
    "transform": "translateY(5%)",
    "transition": "transform 0.5s ease-in-out",
    "opacity": "0.8"
  },
  "duration": 0.5
}
```

**Параметры:**
- `character` (строка, обязательно) — ID персонажа
- `part` (строка, обязательно) — название части тела (head, body, arms, legs и т.д.)
- `styles` (объект, опционально) — CSS свойства для применения к части тела
- `duration` (число, опционально) — длительность анимации в секундах

**Особенности:**
- Стили применяются сразу к элементу
- Вы сам должны указать transition в стилях для плавности
- После истечения `duration` анимация очищается

### Способ 2: Через класс

```json
{
  "type": "part-animate",
  "character": "mc",
  "part": "head",
  "class": "shake-head",
  "duration": 0.5
}
```

**Параметры:**
- `character` (строка, обязательно) — ID персонажа
- `part` (строка, обязательно) — название части тела
- `class` (строка, обязательно) — CSS класс для применения
- `duration` (число, обязательно) — длительность анимации в секундах

**Особенности:**
- Класс применяется к элементу части тела
- Длительность (`duration`) автоматически устанавливается как CSS переменная `--animation-duration`
- Используется в `@keyframes` анимации: `animation: shakeHead var(--animation-duration, 0.5s) ease-in-out;`
- После истечения `duration` класс и анимация очищаются

## Встроенные классы анимаций

В `character.css` определены следующие классы:

### `shake-head`
Встряхивание головы вверх-вниз (полезно для кашля, удара)
```css
@keyframes shakeHead {
  0% { transform: translateY(0); }
  25% { transform: translateY(5%); }
  50% { transform: translateY(0); }
  75% { transform: translateY(5%); }
  100% { transform: translateY(0); }
}
```

### `tremble`
Дрожание части тела
```css
@keyframes tremble {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(-2%, -2%); }
  50% { transform: translate(2%, 2%); }
  75% { transform: translate(-2%, 2%); }
}
```

### `pulse`
Пульсирующий эффект (увеличение и уменьшение размера)
```css
@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}
```

## Примеры использования

### Пример 1: Кашель с встряхиванием головы

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
},
{
  "type": "dialogue",
  "character": "mc",
  "text": "<p>[кашель]</p><p>«Кх-кх!»</p>"
}
```

### Пример 2: Плавное опускание головы

```json
{
  "type": "part-animate",
  "character": "mc",
  "part": "head",
  "styles": {
    "transform": "translateY(10%)",
    "transition": "transform 1s ease-in-out"
  },
  "duration": 1
}
```

### Пример 3: Дрожание тела (страх, холод)

```json
{
  "type": "part-animate",
  "character": "mc",
  "part": "body",
  "class": "tremble",
  "duration": 1.5
}
```

### Пример 4: Пульсирующий эффект конечности

```json
{
  "type": "part-animate",
  "character": "mc",
  "part": "hand_right",
  "class": "pulse",
  "duration": 0.8
}
```

### Пример 5: Сложная анимация с несколькими стилями

```json
{
  "type": "part-animate",
  "character": "mc",
  "part": "head",
  "styles": {
    "transform": "rotate(10deg) translateY(-5%)",
    "transition": "transform 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)"
  },
  "duration": 0.4
}
```

## Определение собственных классов анимаций

Чтобы добавить свой класс анимации, отредактируйте `character.css`:

```css
.char-part._head.your-animation {
  animation: yourAnimation var(--animation-duration, 1s) ease-in-out;
}

@keyframes yourAnimation {
  0% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(10%);
  }
  100% {
    transform: translateY(0);
  }
}
```

**Важно:** всегда используйте `var(--animation-duration, fallback-value)` для динамической длительности!

## Технические детали

### Как это работает

1. Когда обрабатывается шаг `part-animate`:
   - Функция `animateCharacterPart()` создаёт конфиг анимации
   - Конфиг сохраняется в `character.partAnimations[partName]`
   - Конфиг передаётся как пропс `partAnimations` в компонент `SpritePart`

2. В компоненте `SpritePart`:
   - Вычисляются классы и стили на основе `partAnimation`
   - Для классов применяется динамический класс
   - Для стилей применяются CSS свойства
   - CSS переменная `--animation-duration` устанавливается для классов

3. После истечения `duration`:
   - Анимация автоматически удаляется из `character.partAnimations`
   - Классы и стили перестают применяться

### Структура данных

```javascript
character.partAnimations = {
  "head": {
    styles: { transform: "...", transition: "..." },
    class: null,
    animationDuration: 500 // в миллисекундах
  },
  "hand_right": {
    styles: null,
    class: "shake-head",
    animationDuration: 1000
  }
}
```

## Советы и хитрости

### 1. Плавные переходы с прямыми стилями

Всегда указывайте `transition` в стилях для плавности:

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

### 2. Комбинирование анимаций

Можно применять несколько анимаций подряд:

```json
{
  "type": "part-animate",
  "character": "mc",
  "part": "head",
  "class": "shake-head",
  "duration": 0.5
},
{
  "type": "part-animate",
  "character": "mc",
  "part": "body",
  "class": "pulse",
  "duration": 0.5
}
```

### 3. Координация с диалогом

```json
{
  "type": "dialogue",
  "character": "mc",
  "steps": [
    {
      "text": "Ощущаю холод..."
    }
  ]
},
{
  "type": "part-animate",
  "character": "mc",
  "part": "body",
  "class": "tremble",
  "duration": 1.5
}
```

## Ограничения

- Анимация применяется только к видимым частям тела персонажа
- Нельзя анимировать несуществующие части (ошибка будет залогирована)
- Анимация очищается автоматически через `duration` миллисекунд
- Нельзя применить одновременно и `styles` и `class` (если указаны оба, используется `class`)
