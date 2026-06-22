# Анимация частей тела персонажа

Система анимации частей тела позволяет применять анимации к отдельным частям персонажа (head, body, arms и т.д.) в диалоговых сценариях (JSON).
Доступно два способа:
1. **Прямые стили** — задание CSS свойств напрямую в шаге.
2. **Через класс** — применение предопределённого CSS-класса с автоматической длительностью.

## Быстрый старт (Шпаргалка)

**Встряхивание головы (например, при кашле):**
```json
{
  "type": "part-animate",
  "character": "mc",
  "part": "head",
  "class": "shake-head",
  "duration": 0.5
}
```

**Плавное движение с помощью стилей:**
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

## Синтаксис и параметры шага

```json
{
  "type": "part-animate",
  "character": "имя_персонажа",    // Обязательно (ID персонажа)
  "part": "название_части",        // Обязательно (head, body, arm_left и т.д.)
  "duration": 0.5,                 // Опционально. Секунды (длительность)

  // Вариант 1: Класс
  "class": "shake-head",           // CSS класс из character.css
  
  // Вариант 2: Прямые стили
  "styles": {                      
    "transform": "translateY(5%)",
    "transition": "transform 0.5s ease-in-out"
  }
}
```

> [!WARNING]
> Не используйте одновременно `styles` и `class`. Если указаны оба, приоритет отдаётся `class`.
> После истечения `duration` анимация и классы автоматически удаляются с элемента!

## Встроенные классы

| Класс | Эффект | Сценарий |
|-------|--------|----------|
| `shake-head` | Встряхивание вверх-вниз (2 раза) | Кашель, удар, согласие |
| `tremble` | Дрожание в стороны | Холод, сильный страх |
| `pulse` | Пульсирование (масштабирование) | Биение сердца, магия |

> [!TIP]
> При использовании встроенных классов длительность (`duration`) автоматически устанавливается как CSS переменная `--animation-duration`.
> Например: `animation: shakeHead var(--animation-duration, 0.5s) ease-in-out;`

## Популярные CSS трансформы для стилей

- **Смещение:** `transform: "translateX(10%)"`, `translateY(5%)`
- **Вращение:** `transform: "rotate(15deg)"`
- **Масштаб:** `transform: "scale(1.1)"`
- **Комбинация:** `transform: "translateY(5%) rotate(10deg) scale(1.05)"`

### Easing функции (transition)

При использовании прямых стилей **всегда указывайте `transition`** для плавности!
- `"transform 0.5s ease-in-out"` — Плавный старт и конец
- `"transform 0.5s linear"` — Линейно
- `"transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)"` — Отскок (Bounce)

## Создание собственных классов анимации

Если вам не хватает встроенных классов, вы можете добавить свои в `src/renderer/public/styles/game/character.css`:

```css
.char-part._head.your-animation {
  /* Важно: всегда используйте var(--animation-duration, fallback) */
  animation: yourAnimation var(--animation-duration, 1s) ease-in-out;
}

@keyframes yourAnimation {
  0% { transform: translateY(0); }
  50% { transform: translateY(10%); }
  100% { transform: translateY(0); }
}
```

Посмотреть логику работы можно в `src/renderer/composables/useVisualNovel.js` (функция `animateCharacterPart`). Все операции анимации логируются в консоли с префиксом 🎬.
