<template>
	<div class="tests-content">
		<div class="tests-grid">
			<div
				v-for="card in testCards"
				:key="card.id"
				:class="['test-card', card.disabled ? '__disabled' : '__active']"
				@click="!card.disabled && card.action()"
			>
				<div class="test-card-header">
					<div class="test-card-title-group">
						<span class="test-card-icon">{{ card.icon }}</span>
						<h3 class="test-card-title" :title="card.title">{{ card.title }}</h3>
					</div>
				</div>

				<div class="test-card-body">
					<p class="test-card-desc" :title="card.desc">
						{{ card.desc }}
					</p>
					<div class="test-tags">
						<span v-for="tag in card.tags" :key="tag" class="test-tag">
							{{ tag }}
						</span>
					</div>
				</div>

				<div class="test-card-footer">
					<button
						:class="['test-btn', card.disabled ? 'test-btn-disabled' : 'test-btn-primary']"
						:disabled="card.disabled"
						@click.stop="!card.disabled && card.action()"
					>
						{{ card.disabled ? 'Недоступно' : card.btnText }}
					</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

function launchIsoTester() {
	router.push('/test/isometric')
}

function launchIsoEditor() {
	router.push('/test/isometric-editor')
}

function launchCombatTester() {
	router.push('/test/combat')
}

function launchDataEditor() {
	router.push('/test/data-editor')
}

function launchLocalizationManager() {
	router.push('/test/localization')
}

function launchSkillTreeTester() {
	router.push('/test/skill-tree')
}

function launchCharacterSpriteTester() {
	router.push('/test/character-sprites')
}

function launchStorylineEditor() {
	router.push('/test/storyline-editor')
}

function launchHexEditor() {
	router.push('/test/hex-editor')
}

const testCards = [
	{
		id: 'iso-tester',
		icon: '🗺️',
		title: 'Изометрическая локация',
		desc: '2.5D ромбовидный грид (64×32), перепады высоты Z, пошаговое движение ГГ (A*) и прополка сорняков.',
		tags: ['Сетка 64×32', 'Высоты Z', 'A* Pathfinding', 'Сорняки'],
		btnText: 'Запустить тестер →',
		action: launchIsoTester
	},
	{
		id: 'iso-editor',
		icon: '🛠️',
		title: 'Редактор изометрических карт',
		desc: 'Создание карт с центром (0,0), кисти рельефа, высоты Z, расстановка объектов и экспорт JSON.',
		tags: ['Центр (0,0)', 'Кисти рельефа', 'Слои объектов', 'JSON'],
		btnText: 'Открыть редактор →',
		action: launchIsoEditor
	},
	{
		id: 'combat',
		icon: '⚔️',
		title: 'Пошаговый тактический бой',
		desc: 'Пошаговая тактика в стиле SoC: инициатива ходов, AP / MP, 4 класса и боевой AI противников.',
		tags: ['SoC Style', 'Инициатива', 'AP / MP', 'Боевой AI'],
		btnText: 'Запустить бой →',
		action: launchCombatTester
	},
	{
		id: 'data-editor',
		icon: '📚',
		title: 'Редактор данных',
		desc: 'CRUD игровых сущностей (персонажи, классы, расы, предметы, фракции) с прямой записью в JSON.',
		tags: ['JSON CRUD', 'Связи по ID', 'Файлы данных'],
		btnText: 'Открыть редактор →',
		action: launchDataEditor
	},
	{
		id: 'localization',
		icon: '🌐',
		title: 'Добавить локализацию',
		desc: 'Создание языковых пакетов с клонированием словарей сущностей и сценариев новеллы.',
		tags: ['Мультиязычность', 'Клонирование', 'JSON Словари'],
		btnText: 'Создать локализацию →',
		action: launchLocalizationManager
	},
	{
		id: 'skill-tree',
		icon: '🌳',
		title: 'Древо навыков и прокачка',
		desc: 'Интерактивная уровневая сетка классов и рас: прокачка за очки SP, условия предков (ALL/ANY) и просмотр.',
		tags: ['Уровневая сетка', 'Очки SP', 'Предки ALL/ANY'],
		btnText: 'Запустить тестер →',
		action: launchSkillTreeTester
	},
	{
		id: 'sprite-rig',
		icon: '🎭',
		title: 'Студия спрайтов и риггинга (Live2D-Lite)',
		desc: 'Live2D-Lite: дробление тела, 2D-стикер направления глаз, эмоции, анимации и вращение суставов.',
		tags: ['Live2D-Lite', 'Риггинг', 'Стикер глаз', 'Анимации'],
		btnText: 'Запустить студию →',
		action: launchCharacterSpriteTester
	},
	{
		id: 'storyline',
		icon: '📜',
		title: 'Редактор сценариев и сторилейна',
		desc: 'Визуальный редактор сюжета: дерево папок и файлов, инспектор экшенов и прямой JSON-режим.',
		tags: ['Сторилейн', 'Дерево папок', 'Экшены', 'JSON'],
		btnText: 'Открыть редактор →',
		action: launchStorylineEditor
	},
	{
		id: 'hex-editor',
		icon: '⬡',
		title: 'Редактор гексагональных карт',
		desc: 'Тактический 2.5D гекс-рельеф: реки Civ по граням (ширина 1-3), горные массивы R1-3, холмы, поселения, дороги и мосты.',
		tags: ['Гексы 2.5D', 'Реки Civ', 'Горы R1-3', 'Дороги и мосты'],
		btnText: 'Открыть редактор →',
		action: launchHexEditor
	}
]
</script>

<style scoped>
.tests-content {
	width: 100%;
	min-height: 100%;
	display: flex;
	flex-direction: column;
	font-size: calc(1 * var(--size));
	font-family: Kurale, sans-serif;
}

.tests-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(17.5em, 1fr));
	gap: 0.65em;
	padding-bottom: 1.5em;
}

.test-card {
	position: relative;
	background: rgba(18, 24, 38, 0.75);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.45em;
	padding: 0.65em 0.85em;
	display: flex;
	flex-direction: column;
	justify-content: space-between;
	transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s, background-color 0.2s;
	backdrop-filter: blur(0.3em);
}

.test-card.__active {
	cursor: pointer;
	border-color: rgba(246, 196, 69, 0.3);
}

.test-card.__active:hover {
	z-index: 1;
	transform: translateY(-0.15em);
	border-color: #f6c445;
	background: rgba(26, 35, 54, 0.85);
	box-shadow: 0 0.25em 0.8em rgba(246, 196, 69, 0.2);
}

.test-card.__disabled {
	opacity: 0.5;
	cursor: not-allowed;
	filter: grayscale(0.4);
	background: rgba(15, 20, 30, 0.4);
	border-color: rgba(255, 255, 255, 0.06);
}

.test-card.__disabled:hover {
	transform: none;
	box-shadow: none;
	border-color: rgba(255, 255, 255, 0.06);
}

.test-card-header {
	display: flex;
	align-items: center;
	margin-bottom: 0.35em;
}

.test-card-title-group {
	display: flex;
	align-items: center;
	gap: 0.45em;
	min-width: 0;
	width: 100%;
}

.test-card-icon {
	font-size: 1.25em;
	line-height: 1;
	flex-shrink: 0;
}

.test-card-title {
	font-size: 1.05em;
	font-weight: bold;
	color: #ffffff;
	margin: 0;
	font-family: Overlord, Kurale, serif;
	line-height: 1.25;
	flex: 1;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}

.test-card.__active:hover .test-card-title {
	color: #f6c445;
}

.test-card-body {
	flex: 1;
	display: flex;
	flex-direction: column;
	margin-bottom: 0.5em;
}

.test-card-desc {
	font-size: 0.78em;
	color: #94a3b8;
	line-height: 1.35;
	margin: 0 0 0.4em 0;
	flex: 1;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}

.test-tags {
	display: flex;
	flex-wrap: wrap;
	gap: 0.25em;
}

.test-tag {
	font-size: 0.68em;
	background: rgba(255, 255, 255, 0.08);
	color: #cbd5e1;
	padding: 0.1em 0.35em;
	border-radius: 0.2em;
	border: 1px solid rgba(255, 255, 255, 0.1);
	white-space: nowrap;
}

.test-card-footer {
	margin-top: auto;
}

.test-btn {
	width: 100%;
	padding: 0.32em 0.6em;
	border-radius: 0.3em;
	font-size: 0.82em;
	font-family: Kurale, sans-serif;
	cursor: pointer;
	transition: background-color 0.2s, color 0.2s, border-color 0.2s, box-shadow 0.2s;
}

.test-btn-primary {
	background: #f6c445;
	color: #0f172a;
	border: 1px solid #d9a830;
	font-weight: bold;
}

.test-btn-primary:hover {
	background: #ffd369;
	box-shadow: 0 0 0.6em rgba(246, 196, 69, 0.4);
}

.test-btn-disabled {
	background: rgba(255, 255, 255, 0.05);
	color: #64748b;
	border: 1px solid rgba(255, 255, 255, 0.1);
	cursor: not-allowed;
}
</style>
