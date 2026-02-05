# Инструкция по использованию перенесённых стилей

## Обзор

Все стили из Vue компонентов в папке `src/renderer/components/game/` были перенесены в отдельные CSS файлы в папку `src/renderer/public/styles/game/`. Это обеспечивает лучшую организацию кода и упрощает переиспользование стилей.

## Структура папки styles

```
src/renderer/public/styles/
├── base.css                     # Базовые стили приложения
├── main.css                     # Главный файл (импортирует все)
├── UI/                          # Стили компонентов UI
│   ├── ui.css
│   ├── _root.css               # Переменные цветов и размеров
│   └── ...
└── game/                        # ✅ Стили игровых компонентов
    ├── game.css                # Главный файл игровых стилей
    ├── visual-novel.css        # Стили для VisualNovel компонентов
    ├── character.css           # Стили для Character компонента
    ├── character-stats-modal.css
    ├── text-input-modal.css
    ├── equip-part.css
    └── README.md               # Документация
```

## Как работает импорт стилей

### 1. Главный файл `main.css`
```css
@import './base.css';
@import './UI/ui.css';
@import './game/game.css';     /* ✅ Импорт всех игровых стилей */
```

### 2. Файл `game.css`
```css
@import './visual-novel.css';
@import './character.css';
@import './character-stats-modal.css';
@import './text-input-modal.css';
@import './equip-part.css';

.game-area {
    /* стили основного контейнера игры */
}
```

### 3. Специализированные файлы
Каждый файл содержит стили только для соответствующего компонента с использованием CSS Nesting.

## Как изменять стили

### Пример: Изменение цвета диалога

**Было в Vue файле (VisualNovel.vue):**
```vue
<style>
.dialogue-box {
  background: rgba(0, 0, 0, 0.8);
  /* другие стили */
}
</style>
```

**Теперь в CSS файле (visual-novel.css):**
```css
.dialogue-box {
	background: rgba(0, 0, 0, 0.8);
	/* другие стили */
	
	.speaker {
		/* вложенные стили */
	}
}
```

### Как добавить новый стиль для компонента

1. Найдите соответствующий CSS файл (например, `character-stats-modal.css` для `CharacterStatsModal.vue`)
2. Добавьте стили внутри соответствующего класса
3. Сохраните файл - Vite автоматически перезагрузит приложение

## CSS Переменные

### Цвета из `UI/_root.css`

```css
:root {
	--color-primary: #4CAF50;           /* зелёный */
	--color-secondary: #FF9800;         /* оранжевый */
	--color-black: #000;
	--color-white: #FFF;
	--color-shadow: color-mix(...);     /* тень */
	--color-text-muted: color-mix(...); /* приглушённый текст */
	/* и многое другое */
}
```

### Переменные для персонажей

```css
--char-height           /* Высота персонажа (вычисляется динамически) */
--charspriteH          /* Высота спрайта части персонажа */
--charbodyspriteH      /* Высота спрайта тела персонажа */
--appW                 /* Ширина приложения */
--appH                 /* Высота приложения */
```

## CSS Nesting синтаксис

Все файлы используют современный CSS Nesting для вложенных селекторов:

```css
/* Родительский селектор */
.dialogue-box {
	background: rgba(0, 0, 0, 0.8);
	
	/* Вложенный селектор */
	.speaker {
		color: #ffcc00;
	}
	
	/* Селектор потомка */
	.choices {
		margin-top: 15px;
		
		/* Глубокая вложенность */
		.choice-btn {
			cursor: pointer;
			
			/* Псевдокласс */
			&:hover {
				background: #555;
			}
		}
	}
}
```

### Полезные нesting конструкции

**Псевдоклассы:**
```css
&:hover {
	background: #555;
}

&:focus {
	outline: none;
}

&:disabled {
	opacity: 0.6;
}
```

**Комбинаторы селекторов:**
```css
&:not(._body) {
	position: absolute;
}
```

**Множественные селекторы:**
```css
.modal-header,
.modal-header-no-close {
	padding: 15px 20px;
}
```

## Проверка синтаксиса

Проект использует PostCSS с поддержкой CSS Nesting. Синтаксис автоматически компилируется при сборке проекта.

Для проверки синтаксиса вручную:
```bash
npm run build
```

Если есть ошибки, они будут показаны в выводе.

## Горячая перезагрузка стилей

При разработке стили перезагружаются автоматически:

```bash
npm run dev
```

Измените любой CSS файл - браузер автоматически перезагрузит стили без перезагрузки страницы.

## Часто задаваемые вопросы

### Q: Где найти стили для компонента X?
**A:** Используйте таблицу ниже:

| Компонент | Файл |
|-----------|------|
| VisualNovel.vue | visual-novel.css |
| Background.vue | visual-novel.css |
| DialogueBox.vue | visual-novel.css |
| TitleBlock.vue | visual-novel.css |
| CharacterList.vue | character.css |
| Character.vue | character.css |
| EquipPart.vue | equip-part.css |
| CharacterStatsModal.vue | character-stats-modal.css |
| TextInputModal.vue | text-input-modal.css |

### Q: Я изменил CSS, но изменения не видны
**A:** 
1. Убедитесь, что вы редактируете правильный файл (см. таблицу выше)
2. Сохраните файл
3. Проверьте консоль браузера (F12) на ошибки
4. Если необходимо, очистите кэш браузера (Ctrl+Shift+Delete)

### Q: Как добавить новый компонент с стилями?
**A:**
1. Создайте новый компонент в `src/renderer/components/game/`
2. Создайте новый CSS файл в `src/renderer/public/styles/game/` (например, `my-component.css`)
3. Добавьте импорт в `game.css`: `@import './my-component.css';`
4. Пишите стили с использованием CSS Nesting

### Q: Можно ли использовать SCSS вместо CSS?
**A:** Нет, проект использует чистый CSS с поддержкой Nesting через PostCSS. Это обеспечивает лучшую производительность и совместимость.

## Контролист для добавления новых стилей

- ☑ Создан новый CSS файл в `src/renderer/public/styles/game/`
- ☑ Стили организованы с использованием CSS Nesting
- ☑ Добавлен импорт в `game.css`
- ☑ Классы в Vue компоненте соответствуют селекторам в CSS
- ☑ Использованы существующие переменные из `UI/_root.css` (если применимо)
- ☑ Добавлены переходы (transitions) для интерактивных элементов
- ☑ Проверен синтаксис: `npm run build`
- ☑ Проверено на разных размерах экрана (adaptive design)
