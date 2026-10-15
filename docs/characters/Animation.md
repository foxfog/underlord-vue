# Руководство по системе анимации персонажей (Canvas 2D Character Animation Engine)

Система анимации персонажей построена на аппаратном 2D Canvas рендеринге (`CharacterCanvas.vue` + `CharacterRigRenderer`) и едином движке анимаций (`src/renderer/utils/character/characterAnimationEngine.js`).

Она позволяет описывать анимации как **в коде**, так и **в JSON-сценариях новеллы** или **файлах персонажей**, поддерживая:
- Привычный **CSS-Keyframes синтаксис** (`0%`, `50%`, `100%`) и CSS-трансформы (`translate`, `rotate`, `scale`).
- Профессиональный **трековый таймлайн формат** (как в Редакторе кукол / Character Rig Studio).
- Зацикленность и режимы повторений (`once`, `loop`, `pingpong`, `count`).
- Все виды трансформаций: наклоны/повороты (`rotate`), сдвиги (`translateX`/`Y`), масштабирование/зум (`scale`, `scaleX`/`Y`), прозрачность (`opacity`), сглаживание (`easing`).

---

## 1. Быстрый старт: Шпаргалка синтаксиса

### А. В сценарии новеллы (Visual Novel JSON)

#### 1. Вызов зарегистрированной анимации с повторениями:
```json
{
  "type": "character-animate",
  "character": "mc",
  "animation": "cough",
  "duration": 0.5,
  "repeat": "count",
  "repeatCount": 2
}
```

#### 2. Прямое описание анимации через CSS-keyframes в шаге:
```json
{
  "type": "character-animate",
  "character": "mc",
  "duration": 0.8,
  "repeat": "count",
  "repeatCount": 2,
  "keyframes": {
    "0%": {
      "head": { "rotate": 0, "y": 0 },
      "neck": { "rotate": 0 }
    },
    "50%": {
      "head": { "rotate": -3, "y": 3, "x": -2.5 },
      "neck": { "rotate": -8 }
    },
    "100%": {
      "head": { "rotate": 0, "y": 0 },
      "neck": { "rotate": 0 }
    }
  }
}
```

#### 3. Анимация отдельной части тела (`part-animate`):
```json
{
  "type": "part-animate",
  "character": "mc",
  "part": "head",
  "duration": 0.4,
  "repeat": "count",
  "repeatCount": 3,
  "keyframes": {
    "0%":   { "rotate": 0, "x": 0 },
    "25%":  { "rotate": -10, "x": -2 },
    "75%":  { "rotate": 10, "x": 2 },
    "100%": { "rotate": 0, "x": 0 }
  }
}
```

#### 4. Прямая CSS-строка трансформации:
```json
{
  "type": "part-animate",
  "character": "mc",
  "part": "head",
  "styles": {
    "transform": "translateY(5%) rotate(5deg)",
    "transition": "transform 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)"
  },
  "duration": 0.4
}
```

---

## 2. Регистрация анимаций вручную в коде (JavaScript / Vue)

Вы можете зарегистрировать новую анимацию в любой момент через модуль `characterAnimationEngine.js`. После вызова `registerCharacterAnimation` анимация становится доступной глобально во всех сценариях сторилайна и в превью редактора кукол.

```javascript
import { registerCharacterAnimation } from '@/utils/character/characterAnimationEngine'

// Вариант 1: CSS-Keyframes стиль
registerCharacterAnimation({
  id: 'polite_bow',
  name: 'Вежливый поклон',
  duration: 1.2,
  repeat: 'once',
  keyframes: {
    '0%': {
      body: { rotate: 0, y: 0 },
      head: { rotate: 0 }
    },
    '40%': {
      body: { rotate: 20, y: 4 },
      head: { rotate: 10 }
    },
    '70%': {
      body: { rotate: 20, y: 4 },
      head: { rotate: 10 }
    },
    '100%': {
      body: { rotate: 0, y: 0 },
      head: { rotate: 0 }
    }
  }
})

// Вариант 2: CSS transform-строки в keyframes
registerCharacterAnimation({
  id: 'jump_joy',
  name: 'Подпрыгивание от радости',
  duration: 0.6,
  repeat: 'count',
  repeatCount: 2,
  keyframes: {
    '0%':   { body: 'translate(0, 0) scale(1)' },
    '40%':  { body: 'translate(0, -8%) scale(1.05)' },
    '60%':  { body: 'translate(0, -8%) scale(1.05)' },
    '100%': { body: 'translate(0, 0) scale(1)' }
  }
})

// Вариант 3: Профессиональный трековый таймлайн формат
registerCharacterAnimation({
  id: 'look_around',
  name: 'Оглядывание по сторонам',
  duration: 2.0,
  repeat: 'once',
  tracks: [
    {
      target: 'head',
      keyframes: [
        { time: 0.0, transform: { rotate: 0, translateX: 0 }, easing: 'ease-in-out' },
        { time: 0.5, transform: { rotate: -15, translateX: -3 }, easing: 'ease-in-out' },
        { time: 1.0, transform: { rotate: 0, translateX: 0 }, easing: 'ease-in-out' },
        { time: 1.5, transform: { rotate: 15, translateX: 3 }, easing: 'ease-in-out' },
        { time: 2.0, transform: { rotate: 0, translateX: 0 }, easing: 'ease-in-out' }
      ]
    }
  ]
})
```

### Методы API:

| Метод | Описание |
|---|---|
| `registerCharacterAnimation(def)` | Регистрирует и нормализует анимацию любого формата в глобальном реестре. |
| `unregisterCharacterAnimation(id)` | Удаляет анимацию из реестра по ID. |
| `getCharacterAnimation(id)` | Возвращает канонический объект анимации по ID (или `null`). |
| `getAllCharacterAnimations()` | Возвращает массив всех зарегистрированных анимаций. |
| `loadCharacterAnimations(array)` | Пакетно регистрирует массив анимаций (например, загруженный из `animations.json`). |
| `evaluateAnimationAtTime(def, timeSec)` | Вычисляет точные трансформации всех частей для заданного времени в секундах. |

---

## 3. Поддерживаемые параметры и свойства

### 1. Параметры анимации

| Поле | Тип | По умолчанию | Описание |
|---|---|---|---|
| `id` | `string` | генерируется | Уникальный идентификатор анимации. |
| `name` | `string` | `id` | Понятное имя для интерфейса / редактора. |
| `duration` | `number` | `1.0` | Длительность **одного цикла** в секундах (например, `0.5`, `1.3`). |
| `repeat` | `string` | `'once'` | Режим повторения: `'once'`, `'loop'`, `'pingpong'`, `'count'`. |
| `repeatCount` | `number` | `1` | Число повторений (для `repeat: 'count'`). |
| `keyframes` | `object` / `array` | — | Шаги анимации в CSS-стиле. |
| `tracks` | `array` | — | Массив треков частей тела с таймлайном. |

### 2. Режимы повторения (`repeat`)

- `'once'` — однократное воспроизведение от 0 до 100%, возврат в исходную позу.
- `'loop'` — непрерывное зацикленное воспроизведение (пока не будет остановлено сценарием или сменена сцена).
- `'pingpong'` — воспроизведение вперед-назад (0% &rarr; 100% &rarr; 0%).
- `'count'` — повторяет цикл ровно `repeatCount` раз (например, кашлянуть 2 раза или кивнуть 3 раза).

### 3. Свойства трансформации в кадрах (Keyframe Properties)

Все свойства интерполируются плавно с учетом функции `easing`:

| Свойство | Алиасы | Единицы | Описание | Пример |
|---|---|---|---|---|
| `rotate` | `rot` | градусы | Поворот / наклон части тела | `rotate: -8`, `rotate: 15` |
| `translateX` | `x` | % спрайта | Сдвиг по горизонтали (влево/вправо) | `x: -2.5`, `x: 5` |
| `translateY` | `y` | % спрайта | Сдвиг по вертикали (вверх/вниз) | `y: 3.0`, `y: -10` |
| `scale` | — | множитель | Равномерное масштабирование (1.0 = 100%) | `scale: 1.05`, `scale: 0.9` |
| `scaleX` | — | множитель | Масштабирование только по ширине | `scaleX: 1.1` |
| `scaleY` | — | множитель | Масштабирование только по высоте | `scaleY: 0.95` |
| `opacity` | — | 0.0 .. 1.0 | Прозрачность части тела | `opacity: 0.5` |
| `screenAngle` | `depthAngle`, `screen_angle` | градусы | Угол наклона плоскости вращения к экрану (для кукол полубоком $3/4$ или вытягивания руки к экрану) | `screenAngle: 35`, `screenAngle: 45` |
| `rotateX` | `rotX` | градусы | 3D наклон по оси X (наклон вперед/назад) | `rotateX: 10` |
| `rotateY` | `rotY` | градусы | 3D наклон по оси Y (поворот вполоборота) | `rotateY: 20` |

### 4. Функции плавности (`easing`)

- `'ease-in-out'` (по умолчанию) — плавный старт и плавное замедление в конце.
- `'ease-out'` — быстрый импульсивный старт и плавное торможение (идеально для ударов, толчков кашля).
- `'ease-in'` — медленный старт с ускорением в конце.
- `'linear'` — равномерное движение с постоянной скоростью.
- `'step'` — мгновенное переключение без сглаживания (для резкой дрожи или спрайтовых скачков).
- `cubic-bezier(x1, y1, x2, y2)` — произвольная кривая Безье (например, для эффекта отдачи / пружины: `cubic-bezier(0.68, -0.55, 0.265, 1.55)`).

---

## 4. Встроенные базовые анимации (Built-in Animations)

В систему изначально встроены следующие анимации (доступны по имени в `character-animate`):

| ID | Имя | По умолчанию | Описание движения |
|---|---|---|---|
| `cough` | Кашель / Чих | 0.5s (`once`) | Плавный наклон шеи на $-8^\circ$ и два резких толчка головы («кх-кх» $X: -2.5\%$, $Y: 3\%$, наклон $-3^\circ$). |
| `wave_hand` | Махание рукой | 1.0s (`count: 2`) | Подъем плеча на $-55^\circ$, колебание предплечья $\pm 28^\circ$ и кисти $\pm 15^\circ$. |
| `breathing` | Дыхание (Обычное) | 3.2s (`loop`) | Мягкое спокойное дыхание: плавный подъем корпуса ($Y: -1\%$), расширение груди и бюста ($1.018\times .. 1.025\times$), подъем плеч и противофазное покачивание головы. |
| `breathing_heavy` | Дыхание (Запыханное) | 1.2s (`loop`) | Учащенное глубокое запыханное дыхание: выраженный подъем груди ($Y: -2.2\%$), сильное расширение бюста ($1.06\times$), вздымание плеч ($Y: -1.6\%$) и кивки головы при отдышке. |
| `nod` | Кивок | 0.5s (`count: 2`) | Двойной согласный кивок головы ($+16^\circ$) и шеи ($+8^\circ$). |
| `head_shake` | Отрицание | 0.4s (`count: 2`) | Покачивание головы влево-вправо ($\pm 14^\circ$). |
| `tremble` | Дрожь тела | 0.1s (`loop`) | Быстрая высокочастотная вибрация корпуса ($X: \pm 1\%$, наклон $\pm 2^\circ$). |
| `pulse` | Пульсация | 0.6s (`loop`) | Ритмичное увеличение и уменьшение масштаба ($1.0 \leftrightarrow 1.06$). |

---

## 5. Добавление через JSON-файлы персонажей (`animations.json`)

В папке данных персонажа:
`src/renderer/public/data/characters/[character_id]/animations.json`
можно хранить массив кастомных анимаций.

При загрузке персонажа в игру или студию ригов этот файл автоматически считывается и регистрирует анимации в глобальном движке:

```json
[
  {
    "id": "my_scared_reaction",
    "name": "Испуг",
    "duration": 0.4,
    "repeat": "once",
    "tracks": [
      {
        "target": "head",
        "keyframes": [
          { "time": 0, "transform": { "rotate": 0, "translateY": 0, "scale": 1 }, "easing": "ease-out" },
          { "time": 0.15, "transform": { "rotate": -6, "translateY": -3, "scale": 1.04 }, "easing": "ease-out" },
          { "time": 0.4, "transform": { "rotate": 0, "translateY": 0, "scale": 1 }, "easing": "ease-in-out" }
        ]
      }
    ]
  }
]
```

---

## 6. Как устроен рендеринг в CharacterCanvas (Архитектура)

1. **Иерархический Scene Graph**:
   Когда наклоняется шея (`neck`), голова (`head`) автоматически наследует ее поворот, так как является дочерней нодой в кинематическом дереве куклы. При этом собственные смещения головы суммируются с поворотом шеи.
2. **Нулевая нагрузка в покое**:
   Анимационный цикл `requestAnimationFrame` запускается только тогда, когда на персонаже есть активная анимация. Как только все шаги выполнены (или таймер истек), все смещения обнуляются, вызывается финальный кадр покоя, и цикл RAF полностью выключается (потребление ресурсов равно 0%).
3. **Безотказность (Fallbacks)**:
   Если у персонажа отсутствует отдельный спрайт шеи, смещение и наклон шеи автоматически перенаправляются непосредственно в спрайт головы.
