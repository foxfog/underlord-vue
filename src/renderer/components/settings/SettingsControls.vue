<template>
	<div class="settings-list settings-controls-list">
		<div class="settings-controls-section-title">
			<span class="section-icon">📖</span>
			<span>Сюжет и диалоги</span>
		</div>

		<div class="settings-item controls-item">
			<div class="left">
				<div class="settings-item-label">Быстрая перемотка (Skip Mode)</div>
				<div class="settings-item-description">
					Удерживайте для быстрой прокрутки прочитанных реплик. Анимация печати пропускается. Перемотка автоматически останавливается перед развилками выбора, запросами ввода текста и при завершении сцены.
				</div>
			</div>
			<div class="right">
				<div class="key-combo">
					<kbd class="key-badge">Ctrl</kbd>
					<span class="key-badge-tag">Удержание</span>
				</div>
			</div>
		</div>

		<div class="settings-item controls-item">
			<div class="left">
				<div class="settings-item-label">Скрыть интерфейс (Hide UI)</div>
				<div class="settings-item-description">
					Скрывает диалоговое окно, верхний статус-бар и кнопки для просмотра арта сцены. Для возврата интерфейса нажмите повторно H, Esc, Пробел или кликните в любое место экрана.
				</div>
			</div>
			<div class="right">
				<div class="key-combo">
					<kbd class="key-badge">H</kbd>
					<span class="key-sep">/</span>
					<kbd class="key-badge">Р</kbd>
				</div>
			</div>
		</div>

		<div class="settings-item controls-item">
			<div class="left">
				<div class="settings-item-label">Продвижение текста</div>
				<div class="settings-item-description">
					Завершает текущую анимацию печати реплики либо переходит к следующему шагу сюжета.
				</div>
			</div>
			<div class="right">
				<div class="key-combo">
					<kbd class="key-badge">ЛКМ</kbd>
					<span class="key-sep">/</span>
					<kbd class="key-badge">Пробел</kbd>
					<span class="key-sep">/</span>
					<kbd class="key-badge">Enter</kbd>
				</div>
			</div>
		</div>

		<div class="settings-controls-section-title __mt">
			<span class="section-icon">⚙️</span>
			<span>Навигация и меню</span>
		</div>

		<div class="settings-item controls-item">
			<div class="left">
				<div class="settings-item-label">Главное меню / Пауза</div>
				<div class="settings-item-description">
					Закрывает активное всплывающее окно (инвентарь, карту, журнал) либо вызывает игровое меню паузы для сохранения, загрузки и настроек.
				</div>
			</div>
			<div class="right">
				<div class="key-combo">
					<kbd class="key-badge">Esc</kbd>
				</div>
			</div>
		</div>

		<div class="settings-item controls-item">
			<div class="left">
				<div class="settings-item-label">Переключение режима карты</div>
				<div class="settings-item-description">
					В окне карты быстро переключает масштаб между глобальной картой мира и локальной картой текущего региона.
				</div>
			</div>
			<div class="right">
				<div class="key-combo">
					<kbd class="key-badge">L</kbd>
					<span class="key-sep">/</span>
					<kbd class="key-badge">Д</kbd>
					<span class="key-badge-tag">В окне карты</span>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
// Purely informational controls reference view.
// Key rebinding can be added here in future updates.
</script>

<style scoped>
.settings-controls-list {
	display: flex;
	flex-direction: column;
	max-height: 100%;
}

.settings-controls-section-title {
	display: flex;
	align-items: center;
	gap: 0.5em;
	font-size: 1.15em;
	font-weight: 600;
	color: var(--color-primary, #d4af37);
	text-transform: uppercase;
	letter-spacing: 0.06em;
	padding-bottom: 0.45em;
	border-bottom: 1px solid rgba(212, 175, 55, 0.3);
	margin-bottom: 0.25em;

	&.__mt {
		margin-top: 1.25em;
	}

	.section-icon {
		font-size: 1.1em;
	}
}

.controls-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	border-bottom: 1px solid var(--color-border, rgba(255, 255, 255, 0.1));
	padding-top: 0.85em;
	padding-bottom: 0.85em;

	.left {
		width: 60%;
		padding-right: 1.5em;

		.settings-item-label {
			font-size: 1.15em;
			font-weight: 600;
			color: #ffffff;
			line-height: 1.3em;
		}

		.settings-item-description {
			font-size: 0.85em;
			color: rgba(200, 205, 220, 0.75);
			line-height: 1.4em;
			margin-top: 0.25em;
		}
	}

	.right {
		width: 40%;
		display: flex;
		justify-content: flex-end;
		align-items: center;
	}
}

.key-combo {
	display: inline-flex;
	align-items: center;
	gap: 0.4em;
	flex-wrap: wrap;
	justify-content: flex-end;
}

.key-badge {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-width: 2.2em;
	padding: 0.25em 0.65em;
	font-family: inherit;
	font-size: 0.95em;
	font-weight: 700;
	color: #ffd700;
	background: linear-gradient(180deg, rgba(35, 40, 55, 0.9) 0%, rgba(18, 22, 32, 0.95) 100%);
	border: 1px solid rgba(255, 215, 0, 0.4);
	border-bottom: 2px solid rgba(255, 215, 0, 0.7);
	border-radius: 0.35em;
	box-shadow: 0 0.15em 0.35em rgba(0, 0, 0, 0.5), inset 0 0.06em 0 rgba(255, 255, 255, 0.12);
	text-align: center;
	white-space: nowrap;
	user-select: none;
	letter-spacing: 0.03em;
	transition: border-color 0.2s, box-shadow 0.2s, transform 0.15s;

	&:hover {
		border-color: rgba(255, 215, 0, 0.75);
		box-shadow: 0 0.2em 0.5em rgba(0, 0, 0, 0.6), 0 0 0.4em rgba(255, 215, 0, 0.3);
		transform: translateY(-0.08em);
	}
}

.key-badge-tag {
	display: inline-flex;
	align-items: center;
	font-size: 0.75em;
	font-weight: 600;
	color: #ffd700;
	background: rgba(212, 175, 55, 0.15);
	border: 1px solid rgba(212, 175, 55, 0.35);
	border-radius: 0.3em;
	padding: 0.15em 0.45em;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	white-space: nowrap;
}

.key-sep {
	font-size: 0.9em;
	color: rgba(255, 255, 255, 0.4);
	font-weight: 500;
	margin: 0 0.1em;
}
</style>
