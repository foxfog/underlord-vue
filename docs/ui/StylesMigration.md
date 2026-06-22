# Использование и структура стилей (CSS)

Все стили вынесены из Vue-компонентов в отдельные CSS файлы для лучшей организации и переиспользования.

## Структура папки styles

```text
src/renderer/public/styles/
├── base.css                     # Базовые стили приложения
├── main.css                     # Главный файл (импортирует все остальные)
├── UI/                          # Стили переиспользуемых компонентов UI
│   ├── ui.css
│   └── _root.css                # CSS-переменные (цвета, размеры)
└── game/                        # Стили игровых компонентов
    ├── game.css                 # Главный файл игровых стилей
    ├── visual-novel.css         # Стили визуальной новеллы и диалогов
    ├── character.css            # Стили персонажей
    ├── character-stats-modal.css
    ├── text-input-modal.css
    └── equip-part.css
```

## Как изменять стили

Не добавляйте блок `<style>` в Vue файлы! Редактируйте соответствующие CSS файлы.

Например, для `VisualNovel.vue` редактируйте `visual-novel.css`. Проект использует PostCSS с поддержкой **CSS Nesting**, так что вы можете вкладывать селекторы друг в друга:

```css
.dialogue-box {
  background: rgba(0, 0, 0, 0.8);
  
  .speaker {
    color: #ffcc00;
  }
  
  &:hover {
    background: rgba(0, 0, 0, 0.9);
  }
}
```

## CSS Переменные

Все основные переменные хранятся в `src/renderer/public/styles/UI/_root.css`:
- `--color-primary`, `--color-secondary`, `--color-black`, `--color-white`, `--color-shadow` и т.д.
- Размеры спрайтов и персонажей: `--char-height`, `--charspriteH`, `--charbodyspriteH`.

## Как добавить стили для нового компонента

1. Создайте новый CSS файл в `src/renderer/public/styles/game/` (например, `my-component.css`).
2. Добавьте импорт в `game.css`: `@import './my-component.css';`.
3. Пишите стили с использованием CSS Nesting и существующих CSS-переменных.

Vite автоматически применяет изменения стилей "на лету" (hot reload), поэтому перезагрузка страницы не требуется.
