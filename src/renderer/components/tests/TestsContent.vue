<template>
	<div class="tests-content">
		<div class="tests-grid">
			<!-- Card 1: Isometric Map Tester (Active) -->
			<div class="test-card __active" @click="launchIsoTester">
				<div class="test-card-header">
					<div class="test-card-icon">🗺️</div>
					<span class="test-status-badge __ready">Доступно</span>
				</div>
				<div class="test-card-body">
					<h2 class="test-card-title">Изометрическая локация</h2>
					<p class="test-card-desc">
						Тестирование 2.5D ромбовидного грида (64×32), террас с перепадами высоты Z, пошагового движения ГГ (A*) и интерактивного задания по прополке сорняков на огороде старосты.
					</p>
					<div class="test-tags">
						<span class="test-tag">Сетка 64×32</span>
						<span class="test-tag">Высоты Z</span>
						<span class="test-tag">A* Pathfinding</span>
						<span class="test-tag">Прополка сорняков</span>
					</div>
				</div>
				<div class="test-card-footer">
					<button class="test-btn test-btn-primary" @click.stop="launchIsoTester">
						Запустить тестер →
					</button>
				</div>
			</div>

			<!-- Card 2: Map Editor (Active) -->
			<div class="test-card __active" @click="launchIsoEditor">
				<div class="test-card-header">
					<div class="test-card-icon">🛠️</div>
					<span class="test-status-badge __ready">Доступно</span>
				</div>
				<div class="test-card-body">
					<h2 class="test-card-title">Редактор изометрических карт</h2>
					<p class="test-card-desc">
						Визуальный редактор сетки: выбор папок, создание карт нечетных размеров с центром (0,0), рисование тайлов, высот Z, расстановка объектов и экспорт JSON.
					</p>
					<div class="test-tags">
						<span class="test-tag">Центр (0,0)</span>
						<span class="test-tag">Кисти рельефа</span>
						<span class="test-tag">Слои объектов</span>
						<span class="test-tag">Экспорт JSON</span>
					</div>
				</div>
				<div class="test-card-footer">
					<button class="test-btn test-btn-primary" @click.stop="launchIsoEditor">
						Открыть редактор →
					</button>
				</div>
			</div>

			<!-- Card 3: Tactical Combat Tester (Active) -->
			<div class="test-card __active" @click="launchCombatTester">
				<div class="test-card-header">
					<div class="test-card-icon">⚔️</div>
					<span class="test-status-badge __ready">Доступно</span>
				</div>
				<div class="test-card-body">
					<h2 class="test-card-title">Пошаговый тактический бой</h2>
					<p class="test-card-desc">
						Пошаговая тактическая боёвка в стиле Sword of Convallaria: очередность ходов по инициативе, очки действий AP, мана MP, классы (боец, воин, маг, лучник) и боевой AI противников.
					</p>
					<div class="test-tags">
						<span class="test-tag">SoC Style</span>
						<span class="test-tag">Инициатива</span>
						<span class="test-tag">Очки AP / MP</span>
						<span class="test-tag">Боевой AI</span>
					</div>
				</div>
				<div class="test-card-footer">
					<button class="test-btn test-btn-primary" @click.stop="launchCombatTester">
						Запустить бой →
					</button>
				</div>
			</div>

			<!-- Card 4: Data Editor (Active) -->
			<div class="test-card __active" @click="launchDataEditor">
				<div class="test-card-header">
					<div class="test-card-icon">📚</div>
					<span class="test-status-badge __ready">Доступно</span>
				</div>
				<div class="test-card-body">
					<h2 class="test-card-title">Редактор данных</h2>
					<p class="test-card-desc">
						CRUD-интерфейс управления игровыми сущностями (Персонажи, Классы, Фракции, Расы, Предметы) с прямой записью в файлы JSON и связями по ID.
					</p>
					<div class="test-tags">
						<span class="test-tag">JSON CRUD</span>
						<span class="test-tag">Связи по ID</span>
						<span class="test-tag">Файловая система</span>
					</div>
				</div>
				<div class="test-card-footer">
					<button class="test-btn test-btn-primary" @click.stop="launchDataEditor">
						Открыть редактор →
					</button>
				</div>
			</div>

			<!-- Card 5: Localization Manager (Active) -->
			<div class="test-card __active" @click="launchLocalizationManager">
				<div class="test-card-header">
					<div class="test-card-icon">🌐</div>
					<span class="test-status-badge __ready">Доступно</span>
				</div>
				<div class="test-card-body">
					<h2 class="test-card-title">Добавить локализацию</h2>
					<p class="test-card-desc">
						Создание новых языковых пакетов на основе дефолтного или выбранного языка с автоматическим копированием словарей сущностей и сценариев новеллы для ручного перевода.
					</p>
					<div class="test-tags">
						<span class="test-tag">Мультиязычность</span>
						<span class="test-tag">Клонирование</span>
						<span class="test-tag">JSON Словари</span>
						<span class="test-tag">Сценарии</span>
					</div>
				</div>
				<div class="test-card-footer">
					<button class="test-btn test-btn-primary" @click.stop="launchLocalizationManager">
						Создать локализацию →
					</button>
				</div>
			</div>

			<!-- Card 6: Skill Tree Tester (Active) -->
			<div class="test-card __active" @click="launchSkillTreeTester">
				<div class="test-card-header">
					<div class="test-card-icon">🌳</div>
					<span class="test-status-badge __ready">Доступно</span>
				</div>
				<div class="test-card-body">
					<h2 class="test-card-title">Древо навыков и прокачка</h2>
					<p class="test-card-desc">
						Интерактивная уровневая сетка навыков для классов и рас: прокачка за очки SP, начисление очков уровня класса, условия предков (ALL/ANY) и просмотр произвольных JSON данных.
					</p>
					<div class="test-tags">
						<span class="test-tag">Уровневая сетка</span>
						<span class="test-tag">Очки SP</span>
						<span class="test-tag">Предки ALL/ANY</span>
						<span class="test-tag">JSON Data</span>
					</div>
				</div>
				<div class="test-card-footer">
					<button class="test-btn test-btn-primary" @click.stop="launchSkillTreeTester">
						Запустить тестер →
					</button>
				</div>
			</div>

			<!-- Card 7: Character Sprite Rigging Studio (Live2D-Lite) -->
			<div class="test-card __active" @click="launchCharacterSpriteTester">
				<div class="test-card-header">
					<div class="test-card-icon">🎭</div>
					<span class="test-status-badge __ready">Доступно</span>
				</div>
				<div class="test-card-body">
					<h2 class="test-card-title">Студия спрайтов и риггинга (Live2D-Lite)</h2>
					<p class="test-card-desc">
						Визуальный редактор и тестер спрайтов: иерархическое дробление тела (голова, плечи, предплечья, кисти), круговой стикер направления глаз, переключение эмоций, прямое вращение суставов, анимации (махание, кашель), виды со спины и масштабирование роста.
					</p>
					<div class="test-tags">
						<span class="test-tag">Live2D-Lite</span>
						<span class="test-tag">Риггинг тела</span>
						<span class="test-tag">2D Стикер глаз</span>
						<span class="test-tag">Анимации</span>
						<span class="test-tag">Рост и Scale</span>
					</div>
				</div>
				<div class="test-card-footer">
					<button class="test-btn test-btn-primary" @click.stop="launchCharacterSpriteTester">
						Запустить студию →
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
</script>

<style scoped>
.tests-content {
	width: 100%;
	height: 100%;
	display: flex;
	flex-direction: column;
	font-size: calc(1 * var(--size));
	font-family: Kurale, sans-serif;
}

.tests-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(20em, 3fr));
	gap: 1.5em;
	padding-bottom: 2em;
}

.test-card {
	background: rgba(18, 24, 38, 0.75);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.6em;
	padding: 1.5em;
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
	transform: translateY(-0.25em);
	border-color: #f6c445;
	background: rgba(26, 35, 54, 0.85);
	box-shadow: 0 0.5em 1.5em rgba(246, 196, 69, 0.2);
}

.test-card.__disabled {
	opacity: 0.55;
	cursor: not-allowed;
	background: rgba(15, 20, 30, 0.5);
}

.test-card-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 1em;
}

.test-card-icon {
	font-size: 2em;
}

.test-status-badge {
	font-size: 0.75em;
	font-weight: bold;
	padding: 0.25em 0.6em;
	border-radius: 0.3em;
	text-transform: uppercase;
	letter-spacing: 0.05em;
}

.test-status-badge.__ready {
	background: rgba(16, 185, 129, 0.2);
	color: #10b981;
	border: 1px solid #10b981;
}

.test-status-badge.__wip {
	background: rgba(245, 158, 11, 0.2);
	color: #f59e0b;
	border: 1px solid #f59e0b;
}

.test-status-badge.__planned {
	background: rgba(148, 163, 184, 0.2);
	color: #94a3b8;
	border: 1px solid #94a3b8;
}

.test-card-body {
	flex: 1;
	display: flex;
	flex-direction: column;
	margin-bottom: 1.2em;
}

.test-card-title {
	font-size: 1.3em;
	color: #ffffff;
	margin: 0 0 0.6em 0;
	font-family: Overlord, Kurale, serif;
}

.test-card.__active:hover .test-card-title {
	color: #f6c445;
}

.test-card-desc {
	font-size: 0.9em;
	color: #94a3b8;
	line-height: 1.4;
	margin: 0 0 1em 0;
	flex: 1;
}

.test-tags {
	display: flex;
	flex-wrap: wrap;
	gap: 0.4em;
}

.test-tag {
	font-size: 0.75em;
	background: rgba(255, 255, 255, 0.08);
	color: #cbd5e1;
	padding: 0.2em 0.5em;
	border-radius: 0.2em;
	border: 1px solid rgba(255, 255, 255, 0.1);
}

.test-card-footer {
	margin-top: auto;
}

.test-btn {
	width: 100%;
	padding: 0.6em 1em;
	border-radius: 0.4em;
	font-size: 0.95em;
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
	box-shadow: 0 0 0.8em rgba(246, 196, 69, 0.4);
}

.test-btn-disabled {
	background: rgba(255, 255, 255, 0.05);
	color: #64748b;
	border: 1px solid rgba(255, 255, 255, 0.1);
	cursor: not-allowed;
}
</style>
