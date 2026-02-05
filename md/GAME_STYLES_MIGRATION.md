# Миграция стилей игровых компонентов

## Резюме выполненной работы

Все стили из Vue файлов в папке `src/renderer/components/game` были перенесены в отдельные CSS файлы в папку `src/renderer/public/styles/game` с использованием современного синтаксиса CSS Nesting для красивой организации кода.

## Перенесённые файлы

### Компоненты в папке `game/`:
1. **VisualNovel.vue** → `visual-novel.css`
   - Стили для фона, диалогов, выборов и заголовков
   - Включены стили для кнопок выбора и продолжения

2. **Character.vue** → `character.css`
   - Стили для отображения персонажей
   - Система позиционирования частей тела с использованием CSS переменных

3. **CharacterStatsModal.vue** → `character-stats-modal.css`
   - Стили для модального окна статистики персонажа
   - Включены полосы прогресса для HP и MP

4. **TextInputModal.vue** → `text-input-modal.css`
   - Стили для модального окна ввода текста
   - Поле ввода с focus состояниями
   - Кнопки подтверждения и отмены

5. **EquipPart.vue** → `equip-part.css`
   - Стили для отображения экипировки персонажа

### Компоненты в папке `game/visual-novel/`:
- **Background.vue** - использует класс из `visual-novel.css`
- **CharacterList.vue** - использует стили Character
- **DialogueBox.vue** - использует стили из `visual-novel.css`
- **TitleBlock.vue** - использует стили из `visual-novel.css`

## Структура файлов

```
src/renderer/public/styles/game/
├── game.css                      (главный файл с импортами)
├── visual-novel.css              (стили для VisualNovel, DialogueBox, TitleBlock, Background)
├── character.css                 (стили для Character)
├── character-stats-modal.css      (стили для CharacterStatsModal)
├── text-input-modal.css           (стили для TextInputModal)
├── equip-part.css                (стили для EquipPart)
├── character-nov.css             (пусто)
├── character-iso.css             (пусто)
└── README.md                     (документация)
```

## Особенности реализации

### CSS Nesting
Все стили организованы с использованием CSS Nesting для лучшей читаемости и структурированности:

```css
.dialogue-box {
	/* стили контейнера */
	
	.speaker {
		/* стили вложенного элемента */
	}
	
	.choices {
		/* стили вложенного контейнера */
		
		.choice-btn {
			/* стили глубоко вложенного элемента */
		}
	}
}
```

### Соблюдение единого стиля
- Использованы переменные из `UI/_root.css` для цветов и эффектов
- Соблюдены принципы адаптивности проекта
- Использованы стандартные цвета и размеры шрифтов
- Добавлены плавные переходы и hover эффекты

### Динамические CSS переменные
Стили используют динамические переменные для адаптации к размерам компонентов:
- `--char-height` - вычисляется ResizeObserver'ом в Character.vue
- `--charspriteH` - высота спрайта детали персонажа
- `--charbodyspriteH` - высота спрайта тела персонажа

## Миграция в Vue файлах

Из Vue файлов было удалено встроенное содержимое `<style>` блоков:
- ✅ `VisualNovel.vue` - стили удалены
- ✅ `Character.vue` - стили удалены
- ✅ `CharacterStatsModal.vue` - стили удалены
- ✅ `TextInputModal.vue` - стили удалены
- ✅ `EquipPart.vue` - стили удалены

## Проверка

✅ Проект успешно собирается без ошибок
✅ Все CSS файлы имеют правильный синтаксис
✅ Стили корректно импортируются через `game/game.css`
✅ `game.css` импортируется в `main.css`

## Интеграция со стилями проекта

Главный файл стилей (`src/renderer/public/styles/main.css`) содержит:
```css
@import './base.css';     /* базовые стили */
@import './UI/ui.css';    /* стили компонентов UI */
@import './game/game.css'; /* ✅ стили игровых компонентов */
```

## Документация

Детальная документация структуры стилей находится в `src/renderer/public/styles/game/README.md`.
