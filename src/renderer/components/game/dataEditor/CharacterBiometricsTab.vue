<template>
	<div class="char-biometrics-tab">
		<!-- Quick Visual Studio Navigation Banner -->
		<div class="biometrics-banner-card">
			<div class="bbc-left">
				<span class="bbc-icon">🎭</span>
				<div class="bbc-text">
					<h3 class="bbc-title">Студия спрайтов и риггинга</h3>
					<p class="bbc-desc">
						Настройка скелета, эмоций, взгляда и точная подгонка скейла визуала под канонический рост
						<strong v-if="character.height" class="bbc-highlight">{{ character.height }} см</strong>
						<span v-else class="bbc-highlight">(рост не задан)</span>.
					</p>
				</div>
			</div>
			<div class="bbc-right">
				<button
					type="button"
					class="editor-btn editor-btn-primary __studio-nav-btn"
					title="Перейти к визуальной настройке и подгонке скейла спрайта"
					@click="goToSpriteStudio"
				>
					<span class="btn-icon">🎨</span>
					<span>В Студию спрайтов →</span>
				</button>
			</div>
		</div>

		<!-- Biometrics Sections Grid -->
		<div class="biometrics-sections">
			<!-- SECTION 1: Основные физические параметры -->
			<div class="bio-section-card">
				<div class="bsc-header">
					<span class="bsc-icon">📏</span>
					<span class="bsc-title">Основные параметры тела</span>
				</div>

				<div class="bio-fields-grid">
					<!-- Gender -->
					<div class="bio-field-full">
						<label class="bio-field-label">
							Пол (Gender) <span class="req-star">*</span>
						</label>
						<div class="gender-selector-row">
							<button
								v-for="g in GENDER_OPTIONS"
								:key="'bio-g-' + g.id"
								type="button"
								class="gender-option-btn"
								:class="{ __selected: (character.gender || 'male') === g.id, ['__' + g.id]: true }"
								@click="character.gender = g.id"
							>
								<span class="gender-opt-icon">{{ g.icon }}</span>
								<span class="gender-opt-label">{{ g.label }}</span>
								<span v-if="(character.gender || 'male') === g.id" class="gender-opt-check">✔</span>
							</button>
						</div>
					</div>

					<!-- Height (см) -->
					<div class="bio-field">
						<label class="bio-field-label">
							Рост (см)
							<span class="bio-field-hint">(базовый рост персонажа)</span>
						</label>
						<div class="unit-input-box">
							<input
								v-model.number="character.height"
								type="number"
								min="30"
								max="350"
								class="editor-input"
								placeholder="например: 175"
							/>
							<span class="unit-badge">см</span>
						</div>
					</div>

					<!-- Weight (кг) -->
					<div class="bio-field">
						<label class="bio-field-label">
							Вес (кг)
							<span class="bio-field-hint">(влияет на грузоподъёмность)</span>
						</label>
						<div class="unit-input-box">
							<input
								v-model.number="character.weight"
								type="number"
								min="1"
								max="1500"
								class="editor-input"
								placeholder="например: 60"
							/>
							<span class="unit-badge">кг</span>
						</div>
					</div>

					<!-- Age -->
					<div class="bio-field">
						<label class="bio-field-label">
							Возраст
							<span class="bio-field-hint">(число или текст)</span>
						</label>
						<input
							v-model="character.age"
							type="text"
							class="editor-input"
							placeholder="например: 24, 16, 100+, Неизвестно"
						/>
					</div>

					<!-- Visual Scale (Size) -->
					<div class="bio-field">
						<label class="bio-field-label">
							Скейл визуала (Size / Scale)
							<span class="bio-field-hint">(множитель отображения)</span>
						</label>
						<div class="unit-input-box">
							<input
								:value="character.size ?? 1"
								type="number"
								step="0.001"
								class="editor-input"
								placeholder="1.000"
								@input="character.size = Number($event.target.value)"
							/>
							<span class="unit-badge">x</span>
						</div>
					</div>
				</div>
			</div>

			<!-- SECTION 2: Анатомия и физиология -->
			<div class="bio-section-card">
				<div class="bsc-header">
					<span class="bsc-icon">🧬</span>
					<span class="bsc-title">Анатомия и физиология</span>
				</div>

				<div class="bio-fields-grid">
					<!-- Blood Type -->
					<div class="bio-field">
						<label class="bio-field-label">Группа крови</label>
						<select v-model="character.blood_type" class="editor-select">
							<option :value="undefined">— Не указана —</option>
							<option value="I (O)">I (O) — Первая</option>
							<option value="II (A)">II (A) — Вторая</option>
							<option value="III (B)">III (B) — Третья</option>
							<option value="IV (AB)">IV (AB) — Четвертая</option>
							<option value="unknown">Неизвестно / Иная</option>
						</select>
					</div>

					<!-- Body Build -->
					<div class="bio-field">
						<label class="bio-field-label">Телосложение</label>
						<input
							v-model="character.body_build"
							type="text"
							class="editor-input"
							list="bio-build-datalist"
							placeholder="Атлетическое, среднее, худощавое..."
						/>
						<datalist id="bio-build-datalist">
							<option value="Худощавое / Стройное">Худощавое / Стройное</option>
							<option value="Среднее / Обычное">Среднее / Обычное</option>
							<option value="Атлетическое">Атлетическое</option>
							<option value="Мускулистое / Крупное">Мускулистое / Крупное</option>
							<option value="Миниатюрное">Миниатюрное</option>
							<option value="Скелетное (Нежить)">Скелетное (Нежить)</option>
						</datalist>
					</div>

					<!-- Hair Color -->
					<div class="bio-field">
						<label class="bio-field-label">Цвет волос</label>
						<input
							v-model="character.hair_color"
							type="text"
							class="editor-input"
							placeholder="Тёмные, пепельные, серебристые..."
						/>
					</div>

					<!-- Eye Color -->
					<div class="bio-field">
						<label class="bio-field-label">Цвет глаз</label>
						<input
							v-model="character.eye_color"
							type="text"
							class="editor-input"
							placeholder="Карие, золотистые, алые..."
						/>
					</div>

					<!-- Distinguishing Features -->
					<div class="bio-field-full">
						<label class="bio-field-label">Особые приметы (Шрамы, татуировки, рога, крылья)</label>
						<input
							v-model="character.distinguishing_features"
							type="text"
							class="editor-input"
							placeholder="например: Рога и крылья суккуба, светящиеся красные зрачки..."
						/>
					</div>
				</div>
			</div>

			<!-- SECTION 3: Дополнительные заметки -->
			<div class="bio-section-card">
				<div class="bsc-header">
					<span class="bsc-icon">📝</span>
					<span class="bsc-title">Биографические и медицинские заметки</span>
				</div>

				<div class="bio-field-full">
					<textarea
						v-model="character.biometry_notes"
						class="editor-textarea"
						rows="3"
						placeholder="Дополнительные сведения о строении тела, кибернетических аугментациях, мутациях или расовых особенностях..."
					></textarea>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { GENDER_OPTIONS } from '@/composables/useDataEditor'

const router = useRouter()

const props = defineProps({
	character: {
		type: Object,
		required: true
	}
})

function goToSpriteStudio() {
	router.push({
		path: '/test/character-sprites',
		query: { character: props.character.id }
	})
}
</script>

<style scoped>
.char-biometrics-tab {
	display: flex;
	flex-direction: column;
	gap: 1.2em;
	padding: 0.2em 0.1em;
}

/* Quick Banner Card */
.biometrics-banner-card {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 1em;
	background: linear-gradient(135deg, rgba(246, 196, 69, 0.12) 0%, rgba(14, 20, 32, 0.85) 100%);
	border: 1px solid rgba(246, 196, 69, 0.35);
	border-radius: 0.5em;
	padding: 1em 1.2em;
	box-shadow: 0 0.25em 0.8em rgba(0, 0, 0, 0.3);
}

.bbc-left {
	display: flex;
	align-items: center;
	gap: 0.9em;
}

.bbc-icon {
	font-size: 2em;
}

.bbc-title {
	margin: 0;
	font-size: 1.05em;
	color: #f6c445;
	font-weight: bold;
}

.bbc-desc {
	margin: 0.25em 0 0;
	font-size: 0.82em;
	color: #cbd5e1;
	line-height: 1.4;
}

.bbc-highlight {
	color: #f6c445;
	font-weight: bold;
}

.__studio-nav-btn {
	white-space: nowrap;
	display: flex;
	align-items: center;
	gap: 0.4em;
	font-weight: bold;
	padding: 0.5em 1em;
}

/* Sections */
.biometrics-sections {
	display: flex;
	flex-direction: column;
	gap: 1.2em;
}

.bio-section-card {
	background: rgba(14, 20, 32, 0.65);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 0.5em;
	padding: 1.1em 1.2em;
	display: flex;
	flex-direction: column;
	gap: 0.9em;
}

.bsc-header {
	display: flex;
	align-items: center;
	gap: 0.5em;
	border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	padding-bottom: 0.5em;
}

.bsc-icon {
	font-size: 1.2em;
}

.bsc-title {
	font-size: 0.95em;
	font-weight: bold;
	color: #e2e8f0;
}

/* Grid */
.bio-fields-grid {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 1em;
}

.bio-field-full {
	grid-column: 1 / -1;
	display: flex;
	flex-direction: column;
	gap: 0.35em;
}

.bio-field {
	display: flex;
	flex-direction: column;
	gap: 0.35em;
}

.bio-field-label {
	font-size: 0.82em;
	font-weight: bold;
	color: #94a3b8;
	display: flex;
	align-items: center;
	gap: 0.4em;
}

.bio-field-hint {
	font-size: 0.85em;
	color: #64748b;
	font-weight: normal;
}

.req-star {
	color: #ef4444;
}

/* Unit Input */
.unit-input-box {
	position: relative;
	display: flex;
	align-items: center;
}

.unit-input-box .editor-input {
	padding-right: 2.4em;
	width: 100%;
}

.unit-badge {
	position: absolute;
	right: 0.8em;
	font-size: 0.78em;
	color: #94a3b8;
	pointer-events: none;
	font-weight: bold;
}

/* Gender Row */
.gender-selector-row {
	display: flex;
	flex-wrap: wrap;
	gap: 0.6em;
}

.gender-option-btn {
	display: flex;
	align-items: center;
	gap: 0.4em;
	padding: 0.4em 0.9em;
	border-radius: 0.35em;
	background: rgba(255, 255, 255, 0.05);
	border: 1px solid rgba(255, 255, 255, 0.12);
	color: #cbd5e1;
	cursor: pointer;
	font-size: 0.84em;
	transition: all 0.15s ease;
}

.gender-option-btn:hover {
	background: rgba(255, 255, 255, 0.1);
	border-color: rgba(255, 255, 255, 0.25);
}

.gender-option-btn.__selected {
	background: rgba(246, 196, 69, 0.2);
	border-color: #f6c445;
	color: #f6c445;
	font-weight: bold;
}

.gender-option-btn.__male.__selected {
	background: rgba(59, 130, 246, 0.2);
	border-color: #3b82f6;
	color: #60a5fa;
}

.gender-option-btn.__female.__selected {
	background: rgba(236, 72, 153, 0.2);
	border-color: #ec4899;
	color: #f472b6;
}

.gender-opt-icon {
	font-size: 1.05em;
}

.gender-opt-check {
	font-size: 0.8em;
	margin-left: 0.2em;
}
</style>
