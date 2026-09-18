<template>
	<Transition name="cae-drawer">
		<div v-if="isOpen" class="cae-modal-backdrop" @click.self="onClose">
			<div class="cae-modal-container" :class="{ __collapsed: isCollapsed }" @click.stop>
				<!-- Header -->
				<div class="cae-header">
					<div class="cae-header-title-box">
						<span class="cae-header-icon" :title="localAnim.name">{{ localAnim.icon || '🎬' }}</span>
						<div v-if="!isCollapsed" class="cae-header-meta">
							<h2 class="cae-title">{{ localAnim.name || 'Редактор анимации' }}</h2>
							<span class="cae-id-badge">ID: {{ localAnim.id }}</span>
						</div>
					</div>

					<div class="cae-header-quick-controls">
						<button
							v-if="!isCollapsed"
							type="button"
							class="cae-btn __play"
							:class="{ __active: isPlayingPreview }"
							@click="togglePreview"
						>
							{{ isPlayingPreview ? '⏹ Стоп' : '▶ Проиграть' }}
						</button>
						<button
							type="button"
							class="cae-icon-btn"
							:title="isCollapsed ? 'Развернуть редактор (освободить панель)' : 'Свернуть редактор (освободить холст)'"
							@click="isCollapsed = !isCollapsed"
						>
							{{ isCollapsed ? '▶' : '◀' }}
						</button>
						<button type="button" class="cae-close-btn" title="Закрыть (ESC)" @click="onClose">
							✕
						</button>
					</div>
				</div>

				<!-- Scrollable Body (hidden when collapsed) -->
				<div v-show="!isCollapsed" class="cae-body">
					<!-- Section 1: General Settings Card -->
					<div class="cae-card">
						<div class="cae-card-title">Параметры анимации</div>
						<div class="cae-grid-form">
							<!-- Name + Icon Row -->
							<div class="cae-form-field __col-span-2">
								<div class="cae-name-icon-row">
									<div class="cae-name-field">
										<label class="cae-label">Название:</label>
										<input v-model="localAnim.name" type="text" class="cae-input" placeholder="Название анимации" />
									</div>
									<div class="cae-icon-field">
										<label class="cae-label">Иконка:</label>
										<input v-model="localAnim.icon" type="text" class="cae-input __center" placeholder="🤧" />
									</div>
								</div>
							</div>

							<!-- Group -->
							<div class="cae-form-field">
								<label class="cae-label">Группа / Папка:</label>
								<input
									v-model="localAnim.group"
									type="text"
									list="cae-groups-datalist"
									class="cae-input"
									placeholder="Кастомные"
								/>
								<datalist id="cae-groups-datalist">
									<option v-for="g in availableGroups" :key="g" :value="g">{{ g }}</option>
								</datalist>
							</div>

							<!-- Duration -->
				<div class="cae-form-field __col-span-2">
					<label class="cae-label">Длительность (с):</label>
					<div class="cae-duration-row">
						<input
							v-model.number="localAnim.duration"
							type="number"
							min="0.1"
							max="300"
							step="0.1"
							class="cae-input __compact-num"
						/>
						<div class="cae-duration-presets">
							<button v-for="d in [0.5, 1, 1.3, 2, 3, 5, 10, 30]" :key="d"
								type="button"
								class="cae-dur-preset"
								:class="{ __active: localAnim.duration === d }"
								@click="localAnim.duration = d"
							>{{ d }}s</button>
						</div>
					</div>
				</div>

							<!-- Repeat Mode -->
							<div class="cae-form-field" :class="{ '__col-span-2': localAnim.repeat !== 'count' }">
								<label class="cae-label">Повторение:</label>
								<select v-model="localAnim.repeat" class="cae-select">
									<option value="loop">Бесконечный цикл (Loop)</option>
									<option value="once">Один раз (Once)</option>
									<option value="pingpong">Туда-обратно (Ping-Pong)</option>
									<option value="count">Заданное число раз (Count)</option>
								</select>
							</div>

							<!-- Repeat Count if 'count' -->
							<div v-if="localAnim.repeat === 'count'" class="cae-form-field">
								<label class="cae-label">Число повторов:</label>
								<input v-model.number="localAnim.repeatCount" type="number" min="1" class="cae-input" />
							</div>

							<!-- Description -->
							<div class="cae-form-field __col-span-2">
								<label class="cae-label">Описание:</label>
								<input
									v-model="localAnim.desc"
									type="text"
									class="cae-input"
									placeholder="Краткое описание механики движения"
								/>
							</div>
						</div>
					</div>

					<!-- Builtin Animation Notice Banner -->
					<div v-if="isBuiltinAnimation" class="cae-builtin-notice">
						<span class="cae-builtin-icon">🔒</span>
						<span>Встроенная анимация «Базовые» — редактирование треков доступно в предпросмотре, но сохранение в файл недоступно. Нажмите <b>📋 Дублировать</b> на карточке, чтобы создать редактируемую копию.</span>
					</div>

					<!-- Section 2: Mode Selector Pills -->
					<div class="cae-mode-pills-row">
					<button
						type="button"
						class="cae-pill-btn"
						:class="{ __active: localAnim.timingMode === 'timeline' }"
						@click="localAnim.timingMode = 'timeline'"
					>
						⏱️ Ключевые кадры (Таймлайн)
					</button>
					<button
						type="button"
						class="cae-pill-btn"
						:class="{ __active: localAnim.timingMode === 'script' }"
						@click="localAnim.timingMode = 'script'"
					>
						💻 Процедурный скрипт (Формула JS)
					</button>
				</div>

					<!-- CSP Warning for Script Mode -->
					<div v-if="localAnim.timingMode === 'script'" class="cae-csp-notice">
						⚠️ <b>Внимание:</b> В production-сборке Electron процедурный скрипт заблокирован политикой CSP (Content Security Policy). Скрипт работает только в dev-режиме (Vite). Используйте <b>Таймлайн</b> для надёжного воспроизведения.
					</div>

				<!-- Live Scrubber Bar (Available for both modes) -->
				<div class="cae-card cae-scrubber-card">
					<div class="cae-scrubber-header">
						<span class="cae-scrubber-title">Таймлайн предпросмотра:</span>
						<span class="cae-scrubber-timer">
							<strong>{{ previewTime.toFixed(2) }}s</strong> / {{ effectiveDuration.toFixed(2) }}s
						</span>
					</div>
					<div class="cae-scrubber-row">
						<button
							type="button"
							class="cae-btn-icon"
							:class="{ __active: isPlayingPreview }"
							@click="togglePreview"
						>
							{{ isPlayingPreview ? '⏸' : '▶' }}
						</button>
						<input
							v-model.number="previewTime"
							type="range"
							min="0"
							:max="effectiveDuration"
							step="0.01"
							class="cae-range cae-scrubber-slider"
							@input="onScrubInput"
						/>
						<button type="button" class="cae-btn-icon" title="В начало" @click="seekTo(0)">
							⏮
						</button>
					</div>
				</div>

				<!-- ================= TIMELINE MODE ================= -->
				<div v-if="localAnim.timingMode === 'timeline'" class="cae-timeline-section">
					<!-- Tracks Control Bar -->
					<div class="cae-tracks-top-bar">
						<span class="cae-section-heading">Дорожки деталей ({{ localAnim.tracks?.length || 0 }}):</span>
						<div class="cae-add-track-controls">
							<select v-model="selectedPartToAdd" class="cae-select __compact">
								<option value="" disabled>Выберите часть тела...</option>
								<option
									v-for="partName in availablePartsToAdd"
									:key="partName"
									:value="partName"
								>
									{{ partName }}
								</option>
							</select>
							<button
								type="button"
								class="cae-btn __accent"
								:disabled="!selectedPartToAdd"
								@click="addTrack(selectedPartToAdd)"
							>
								➕ Добавить дорожку
							</button>
						</div>
					</div>

					<!-- Tracks List -->
					<div v-if="!localAnim.tracks || localAnim.tracks.length === 0" class="cae-empty-state">
						<span>Нет активных дорожек деталей. Добавьте деталь выше (например, head, neck, arm_left).</span>
					</div>

					<div
						v-for="(track, trackIdx) in localAnim.tracks"
						:key="track.target"
						class="cae-card cae-track-card"
					>
						<!-- Track Header -->
						<div class="cae-track-header">
							<div class="cae-track-title-row">
								<span class="cae-part-badge">{{ track.target }}</span>
								<div class="cae-target-mode-toggle">
									<label class="cae-radio-label">
										<input
											v-model="track.targetMode"
											type="radio"
											value="single"
										/>
										Только эта деталь
									</label>
									<label class="cae-radio-label">
										<input
											v-model="track.targetMode"
											type="radio"
											value="hierarchy"
										/>
										Иерархически (со всеми потомками)
									</label>
								</div>
							</div>

							<div class="cae-track-actions">
								<button
									type="button"
									class="cae-mini-btn __accent"
									@click="addKeyframeAtCurrentTime(track)"
								>
									➕ Добавить кадр ({{ previewTime.toFixed(2) }}с)
								</button>
								<button
									type="button"
									class="cae-mini-btn __danger"
									title="Удалить дорожку"
									@click="removeTrack(trackIdx)"
								>
									🗑️
								</button>
							</div>
						</div>

						<!-- Keyframes Timeline Chips -->
						<div class="cae-keyframes-chips-bar">
							<span class="cae-small-label">Ключевые кадры:</span>
							<div class="cae-chips-row">
								<button
									v-for="(kf, kfIdx) in track.keyframes"
									:key="kfIdx"
									type="button"
									class="cae-kf-chip"
									:class="{ __selected: activeTrackTarget === track.target && activeKeyframeIndex === kfIdx }"
									@click="selectKeyframe(track.target, kfIdx)"
								>
									{{ kf.time.toFixed(2) }}с
								</button>
							</div>
						</div>

						<!-- Selected Keyframe Editor -->
						<div
							v-if="activeTrackTarget === track.target && track.keyframes[activeKeyframeIndex]"
							class="cae-kf-editor-panel"
						>
							<div class="cae-kf-editor-header">
								<span class="cae-kf-editor-title">
									Кадр #{{ activeKeyframeIndex + 1 }} на <strong>{{ track.keyframes[activeKeyframeIndex].time.toFixed(2) }}с</strong>
								</span>
								<div class="cae-kf-editor-header-actions">
									<button
										type="button"
										class="cae-mini-btn"
										@click="seekTo(track.keyframes[activeKeyframeIndex].time)"
									>
										🎯 Перейти
									</button>
									<button
										type="button"
										class="cae-mini-btn __danger"
										title="Удалить этот кадр"
										:disabled="track.keyframes.length <= 1"
										@click="removeKeyframe(track, activeKeyframeIndex)"
									>
										🗑️ Удалить кадр
									</button>
								</div>
							</div>

							<!-- Controls for the active keyframe -->
							<div class="cae-kf-controls-grid">
								<!-- Time input -->
								<div class="cae-control-item">
									<div class="cae-ci-label-row">
										<label>Время кадра (сек):</label>
										<span class="cae-ci-val">{{ (track.keyframes[activeKeyframeIndex]?.time ?? 0).toFixed(2) }}с</span>
									</div>
									<input
										v-model.number="track.keyframes[activeKeyframeIndex].time"
										type="number"
										min="0"
										max="300"
										step="0.05"
										class="cae-input __compact"
										@input="onKeyframeTimeInput(track)"
										@change="onKeyframeTimeCommit(track)"
										@blur="onKeyframeTimeCommit(track)"
									/>
									<span class="cae-field-hint">💡 Можно задавать любое время — кадр автоматически займёт своё место в хронологии</span>
								</div>

								<!-- Rotation Slider (-720 to 720) -->
								<div class="cae-control-item">
									<div class="cae-ci-label-row">
										<label>Вращение (Rotate):</label>
										<span class="cae-ci-val">{{ Math.round(track.keyframes[activeKeyframeIndex].transform.rotate || 0) }}°</span>
									</div>
									<div class="cae-slider-input-row">
										<input
											v-model.number="track.keyframes[activeKeyframeIndex].transform.rotate"
											type="range"
											min="-720"
											max="720"
											step="1"
											class="cae-range"
											@input="triggerKeyframePreview(track)"
										/>
										<input
											v-model.number="track.keyframes[activeKeyframeIndex].transform.rotate"
											type="number"
											class="cae-number-input"
											@input="triggerKeyframePreview(track)"
										/>
										<button
											type="button"
											class="cae-micro-btn"
											title="Сброс в 0°"
											@click="track.keyframes[activeKeyframeIndex].transform.rotate = 0; triggerKeyframePreview(track)"
										>
											0°
										</button>
									</div>
								</div>

								<!-- Translate X Slider (-100% to 100%) -->
								<div class="cae-control-item">
									<div class="cae-ci-label-row">
										<label>Смещение X (Translate X):</label>
										<span class="cae-ci-val">{{ (track.keyframes[activeKeyframeIndex].transform.translateX || 0).toFixed(1) }}%</span>
									</div>
									<div class="cae-slider-input-row">
										<input
											v-model.number="track.keyframes[activeKeyframeIndex].transform.translateX"
											type="range"
											min="-100"
											max="100"
											step="0.5"
											class="cae-range"
											@input="triggerKeyframePreview(track)"
										/>
										<input
											v-model.number="track.keyframes[activeKeyframeIndex].transform.translateX"
											type="number"
											step="0.5"
											class="cae-number-input"
											@input="triggerKeyframePreview(track)"
										/>
										<button
											type="button"
											class="cae-micro-btn"
											title="Сброс в 0%"
											@click="track.keyframes[activeKeyframeIndex].transform.translateX = 0; triggerKeyframePreview(track)"
										>
											0
										</button>
									</div>
								</div>

								<!-- Translate Y Slider (-100% to 100%) -->
								<div class="cae-control-item">
									<div class="cae-ci-label-row">
										<label>Смещение Y (Translate Y):</label>
										<span class="cae-ci-val">{{ (track.keyframes[activeKeyframeIndex].transform.translateY || 0).toFixed(1) }}%</span>
									</div>
									<div class="cae-slider-input-row">
										<input
											v-model.number="track.keyframes[activeKeyframeIndex].transform.translateY"
											type="range"
											min="-100"
											max="100"
											step="0.5"
											class="cae-range"
											@input="triggerKeyframePreview(track)"
										/>
										<input
											v-model.number="track.keyframes[activeKeyframeIndex].transform.translateY"
											type="number"
											step="0.5"
											class="cae-number-input"
											@input="triggerKeyframePreview(track)"
										/>
										<button
											type="button"
											class="cae-micro-btn"
											title="Сброс в 0%"
											@click="track.keyframes[activeKeyframeIndex].transform.translateY = 0; triggerKeyframePreview(track)"
										>
											0
										</button>
									</div>
								</div>

								<!-- Scale Slider (0.1 to 3.0) -->
								<div class="cae-control-item">
									<div class="cae-ci-label-row">
										<label>Масштаб (Scale):</label>
										<span class="cae-ci-val">{{ (track.keyframes[activeKeyframeIndex].transform.scale ?? 1).toFixed(2) }}x</span>
									</div>
									<div class="cae-slider-input-row">
										<input
											v-model.number="track.keyframes[activeKeyframeIndex].transform.scale"
											type="range"
											min="0.1"
											max="3"
											step="0.05"
											class="cae-range"
											@input="triggerKeyframePreview(track)"
										/>
										<input
											v-model.number="track.keyframes[activeKeyframeIndex].transform.scale"
											type="number"
											step="0.05"
											class="cae-number-input"
											@input="triggerKeyframePreview(track)"
										/>
										<button
											type="button"
											class="cae-micro-btn"
											title="Сброс в 1.0x"
											@click="track.keyframes[activeKeyframeIndex].transform.scale = 1; triggerKeyframePreview(track)"
										>
											1x
										</button>
									</div>
								</div>

								<!-- Easing Selector -->
								<div class="cae-control-item">
									<div class="cae-ci-label-row">
										<label>Сглаживание (Easing):</label>
									</div>
									<select v-model="track.keyframes[activeKeyframeIndex].easing" class="cae-select __compact">
										<option value="ease-in-out">Плавное (ease-in-out)</option>
										<option value="linear">Линейное (linear)</option>
										<option value="ease-in">Ускорение (ease-in)</option>
										<option value="ease-out">Замедление (ease-out)</option>
										<option value="step">Мгновенно (step)</option>
									</select>
								</div>

								<!-- Sprite Swapping Dropdown -->
								<div class="cae-control-item __wide">
									<div class="cae-ci-label-row">
										<label>🎭 Подмена спрайта на этом кадре:</label>
										<span v-if="track.keyframes[activeKeyframeIndex].sprite" class="cae-badge-on">АКТИВНА</span>
									</div>
									<div class="cae-sprite-swap-row">
										<select
											v-model="track.keyframes[activeKeyframeIndex].sprite"
											class="cae-select"
											@change="triggerKeyframePreview(track)"
										>
											<option :value="null">Без подмены (базовый спрайт детали)</option>
											<option
												v-for="img in availableImages"
												:key="img"
												:value="img"
											>
												{{ img }}
											</option>
										</select>
										<button
											v-if="track.keyframes[activeKeyframeIndex].sprite"
											type="button"
											class="cae-micro-btn"
											title="Сбросить подмену"
											@click="track.keyframes[activeKeyframeIndex].sprite = null; triggerKeyframePreview(track)"
										>
											✕
										</button>
									</div>
								</div>

								<!-- Custom CSS Field -->
								<div class="cae-control-item __wide">
									<div class="cae-ci-label-row">
										<label>Ручные CSS стили (Manual CSS):</label>
										<span class="cae-ci-hint">Пример: opacity: 0.7; filter: blur(1px)</span>
									</div>
									<input
										v-model="track.keyframes[activeKeyframeIndex].customCss"
										type="text"
										class="cae-input __code"
										placeholder="opacity: 0.8; filter: brightness(1.2);"
										@input="triggerKeyframePreview(track)"
									/>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- ================= SCRIPT MODE ================= -->
				<div v-else-if="localAnim.timingMode === 'script'" class="cae-script-section">
					<div class="cae-card">
						<div class="cae-card-header-row">
							<span class="cae-card-title">Код процедурного скрипта (JS Formula):</span>
							<div class="cae-script-presets">
								<span class="cae-ci-hint">Примеры:</span>
								<button type="button" class="cae-mini-btn" @click="loadScriptTemplate('cough')">
									🤧 Кашель
								</button>
								<button type="button" class="cae-mini-btn" @click="loadScriptTemplate('tremble')">
									🥶 Дрожь
								</button>
								<button type="button" class="cae-mini-btn" @click="loadScriptTemplate('breathing')">
									🫁 Дыхание
								</button>
							</div>
						</div>

						<textarea
							v-model="localAnim.script.code"
							rows="11"
							class="cae-code-textarea"
							placeholder="// Напишите формулу тика анимации..."
							spellcheck="false"
							@input="onScriptEdited"
						></textarea>

						<div class="cae-script-help-card">
							<div class="cae-help-title">Доступные переменные и математические функции:</div>
							<div class="cae-help-tags">
								<code>time</code> (сек), <code>progress</code> (0..1), <code>cycle</code>, <code>duration</code>,
								<code>sin()</code>, <code>cos()</code>, <code>tan()</code>, <code>PI</code>,
								<code>abs()</code>, <code>min()</code>, <code>max()</code>, <code>random()</code>,
								<code>parts</code>, <code>getDescendants(part)</code>
							</div>
							<div class="cae-help-desc">
								Функция должна возвращать объект трансформаций деталей:
								<code>return { head: { rot: sin(progress * PI) * -10, x: -2, y: 3 } }</code>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Footer Actions -->
			<div v-show="!isCollapsed" class="cae-footer">
				<div class="cae-footer-left">
					<button type="button" class="cae-btn __secondary" @click="copyVnStep">
						📋 Шаг VN
					</button>
				</div>
				<div class="cae-footer-right">
					<button type="button" class="cae-btn __secondary" @click="onClose">
						Отмена
					</button>
					<button type="button" class="cae-btn __primary" :disabled="isSaving" @click="onSave">
						💾 Сохранить
					</button>
				</div>
			</div>
		</div>
	</div>
</Transition>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { pushModal, removeModal } from '@/composables/useModalStack'

const MODAL_ID = 'character-animation-editor'

const props = defineProps({
	isOpen: {
		type: Boolean,
		default: false
	},
	animationData: {
		type: Object,
		default: null
	},
	characterId: {
		type: String,
		default: 'default'
	},
	bodyParts: {
		type: Object,
		default: () => ({})
	},
	availableImages: {
		type: Array,
		default: () => []
	},
	animationGroups: {
		type: Array,
		default: () => ['all', 'Базовые', 'Кастомные']
	},
	isSaving: {
		type: Boolean,
		default: false
	}
})

const emit = defineEmits(['close', 'save', 'preview-step', 'play', 'stop', 'copy-step'])

const localAnim = ref(createEmptyAnimation())
const isPlayingPreview = ref(false)
const isCollapsed = ref(false)
const previewTime = ref(0)
const selectedPartToAdd = ref('')
const activeTrackTarget = ref('')
const activeKeyframeIndex = ref(0)

// True if the currently edited animation is a built-in preset (non-editable/saveable)
const isBuiltinAnimation = computed(() => {
	return localAnim.value.group === 'Базовые'
})

// Находит максимальное время среди всех ключевых кадров всех дорожек
const maxKeyframeTime = computed(() => {
	let maxTime = 0
	for (const t of (localAnim.value.tracks || [])) {
		for (const kf of (t.keyframes || [])) {
			if (typeof kf?.time === 'number' && kf.time > maxTime) {
				maxTime = kf.time
			}
		}
	}
	return maxTime
})

// Эффективная длительность таймлайна (максимум из заданной duration и времени последнего кадра)
const effectiveDuration = computed(() => {
	const base = Number(localAnim.value.duration) || 1.0
	return Number(Math.max(base, maxKeyframeTime.value).toFixed(2))
})

// Реактивно подтягивает localAnim.duration, если кадры выходят за текущий предел
watch(effectiveDuration, (newDur) => {
	if (newDur > (Number(localAnim.value.duration) || 0)) {
		localAnim.value.duration = newDur
	}
})


function createEmptyAnimation() {
	return {
		id: `anim_${Date.now()}`,
		name: 'Новая анимация',
		icon: '✨',
		desc: '',
		group: 'Кастомные',
		duration: 1.0,
		repeat: 'loop',
		repeatCount: 2,
		timingMode: 'timeline',
		tracks: [],
		script: {
			enabled: false,
			code: `// Процедурный скрипт тика анимации:\nconst wave = sin(progress * 2 * PI);\nreturn {\n  head: { rot: wave * 10, x: wave * 2, y: 0 }\n};`
		}
	}
}

const availableGroups = computed(() => {
	return props.animationGroups.filter((g) => g !== 'all')
})

const availablePartsToAdd = computed(() => {
	const currentTargets = (localAnim.value.tracks || []).map((t) => t.target)
	return Object.keys(props.bodyParts).filter((p) => !currentTargets.includes(p))
})

watch(
	() => props.isOpen,
	(open) => {
		if (open) {
			isCollapsed.value = false
			pushModal(MODAL_ID, onClose)
			if (props.animationData) {
				localAnim.value = JSON.parse(JSON.stringify(props.animationData))
				if (!localAnim.value.tracks) localAnim.value.tracks = []
				if (!localAnim.value.script) {
					localAnim.value.script = {
						enabled: false,
						code: `const wave = sin(progress * 2 * PI);\nreturn {\n  head: { rot: wave * 10, x: wave * 2, y: 0 }\n};`
					}
				}
				syncDurationToKeyframes()
			} else {
				localAnim.value = createEmptyAnimation()
				if (Object.keys(props.bodyParts).length > 0) {
					const firstPart = Object.keys(props.bodyParts)[0]
					addTrack(firstPart)
				}
			}
			previewTime.value = 0
			isPlayingPreview.value = false
			if (localAnim.value.tracks.length > 0) {
				activeTrackTarget.value = localAnim.value.tracks[0].target
				activeKeyframeIndex.value = 0
			}
		} else {
			removeModal(MODAL_ID)
			stopPreview()
		}
	},
	{ immediate: true }
)

onBeforeUnmount(() => {
	removeModal(MODAL_ID)
	stopPreview()
})

function onClose() {
	stopPreview()
	emit('close')
}

function onSave() {
	stopPreview()
	syncDurationToKeyframes()
	emit('save', JSON.parse(JSON.stringify(localAnim.value)))
}

function copyVnStep() {
	emit('copy-step', localAnim.value.id)
}

function togglePreview() {
	if (isPlayingPreview.value) {
		stopPreview()
	} else {
		isPlayingPreview.value = true
		syncDurationToKeyframes()
		emit('play', JSON.parse(JSON.stringify(localAnim.value)))
	}
}

function stopPreview() {
	isPlayingPreview.value = false
	emit('stop')
}

function seekTo(time) {
	previewTime.value = Number(Math.max(0, Math.min(effectiveDuration.value, time)).toFixed(2))
	emit('preview-step', { anim: localAnim.value, time: previewTime.value })
}

function onScrubInput() {
	if (isPlayingPreview.value) {
		stopPreview()
	}
	emit('preview-step', { anim: localAnim.value, time: previewTime.value })
}

function addTrack(partName) {
	if (!partName) return
	if (!localAnim.value.tracks) localAnim.value.tracks = []
	const newTrack = {
		target: partName,
		targetMode: 'single',
		keyframes: [
			{
				time: 0,
				transform: { rotate: 0, translateX: 0, translateY: 0, scale: 1 },
				sprite: null,
				customCss: '',
				easing: 'ease-in-out'
			},
			{
				time: Number((localAnim.value.duration || 1.0).toFixed(2)),
				transform: { rotate: 0, translateX: 0, translateY: 0, scale: 1 },
				sprite: null,
				customCss: '',
				easing: 'ease-in-out'
			}
		]
	}
	localAnim.value.tracks.push(newTrack)
	activeTrackTarget.value = partName
	activeKeyframeIndex.value = 0
	selectedPartToAdd.value = ''
	triggerKeyframePreview(newTrack)
}

function removeTrack(trackIdx) {
	const removed = localAnim.value.tracks.splice(trackIdx, 1)[0]
	if (activeTrackTarget.value === removed?.target) {
		if (localAnim.value.tracks.length > 0) {
			activeTrackTarget.value = localAnim.value.tracks[0].target
			activeKeyframeIndex.value = 0
		} else {
			activeTrackTarget.value = ''
			activeKeyframeIndex.value = 0
		}
	}
}

function selectKeyframe(trackTarget, kfIdx) {
	activeTrackTarget.value = trackTarget
	activeKeyframeIndex.value = kfIdx
	const track = localAnim.value.tracks.find((t) => t.target === trackTarget)
	if (track?.keyframes[kfIdx]) {
		seekTo(track.keyframes[kfIdx].time)
	}
}

function addKeyframeAtCurrentTime(track) {
	const time = Number(previewTime.value.toFixed(2))
	const existingIdx = track.keyframes.findIndex((k) => Math.abs(k.time - time) < 0.03)
	if (existingIdx !== -1) {
		activeTrackTarget.value = track.target
		activeKeyframeIndex.value = existingIdx
		return
	}

	const newKf = {
		time,
		transform: { rotate: 0, translateX: 0, translateY: 0, scale: 1 },
		sprite: null,
		customCss: '',
		easing: 'ease-in-out'
	}
	track.keyframes.push(newKf)
	track.keyframes.sort((a, b) => a.time - b.time)
	activeTrackTarget.value = track.target
	activeKeyframeIndex.value = track.keyframes.indexOf(newKf)
	syncDurationToKeyframes()
	triggerKeyframePreview(track)
}


function removeKeyframe(track, kfIdx) {
	if (track.keyframes.length <= 1) return
	track.keyframes.splice(kfIdx, 1)
	activeKeyframeIndex.value = Math.max(0, kfIdx - 1)
	triggerKeyframePreview(track)
}

/** Автоматически расширяет duration анимации если любой ключевой кадр вышел за её пределы */
function syncDurationToKeyframes() {
	let maxKfTime = 0
	for (const t of (localAnim.value.tracks || [])) {
		for (const kf of (t.keyframes || [])) {
			if (kf.time > maxKfTime) maxKfTime = kf.time
		}
	}
	if (maxKfTime > (localAnim.value.duration || 0)) {
		localAnim.value.duration = Number(maxKfTime.toFixed(2))
	}
}

function onKeyframeTimeInput(track) {
	syncDurationToKeyframes()
	triggerKeyframePreview(track)
}

function onKeyframeTimeCommit(track) {
	const currentKf = track.keyframes[activeKeyframeIndex.value]
	if (!currentKf) return
	if (typeof currentKf.time !== 'number' || isNaN(currentKf.time)) {
		currentKf.time = 0
	}
	track.keyframes.sort((a, b) => (a.time || 0) - (b.time || 0))
	const newIdx = track.keyframes.indexOf(currentKf)
	if (newIdx !== -1) {
		activeKeyframeIndex.value = newIdx
	}
	syncDurationToKeyframes()
	triggerKeyframePreview(track)
}



function triggerKeyframePreview(track) {
	emit('preview-step', { anim: localAnim.value, time: previewTime.value })
}

function onScriptEdited() {
	emit('preview-step', { anim: localAnim.value, time: previewTime.value })
}

function loadScriptTemplate(name) {
	if (name === 'cough') {
		localAnim.value.duration = 1.3
		localAnim.value.script.code = `// Реалистичный двойной кашель из интро:\nconst cycle = time % 1.3;\nlet impulse = 0;\nlet neckTilt = 0;\nif (cycle < 0.5) {\n  if (cycle < 0.25) impulse = sin((cycle / 0.25) * PI);\n  else impulse = sin(((cycle - 0.25) / 0.25) * PI);\n  neckTilt = sin((cycle / 0.5) * PI) * -8;\n}\nreturn {\n  head: { rot: -3 * impulse, x: -2.5 * impulse, y: 3.0 * impulse },\n  neck: { rot: neckTilt },\n  body: { rot: 0, x: 0, y: 0 }\n};`
	} else if (name === 'tremble') {
		localAnim.value.duration = 1.0
		localAnim.value.script.code = `// Дрожь / тремор:\nconst jitter = (random() - 0.5) * 4;\nreturn {\n  body: { rot: jitter * 0.5, x: jitter * 0.5, y: jitter * 0.5 },\n  head: { rot: jitter }\n};`
	} else if (name === 'breathing') {
		localAnim.value.duration = 2.0
		localAnim.value.script.code = `// Плавное ритмичное дыхание:\nconst breath = sin(progress * 2 * PI);\nreturn {\n  body: { rot: breath * 0.4, y: -0.6 * (breath + 1) },\n  head: { rot: -breath * 0.3 }\n};`
	}
	onScriptEdited()
}
</script>

<style scoped>
.cae-modal-backdrop {
	position: absolute;
	top: 3.5em;
	left: 0;
	bottom: 0;
	right: 0;
	background: transparent;
	backdrop-filter: none;
	pointer-events: none;
	display: flex;
	align-items: stretch;
	justify-content: flex-start;
	z-index: 100;
	overflow: hidden;
}

.cae-modal-container {
	position: relative;
	width: 33em;
	max-width: 45%;
	height: 100%;
	background: rgba(18, 22, 31, 0.98);
	border: none;
	border-right: 1px solid rgba(246, 196, 69, 0.35);
	border-radius: 0;
	box-shadow: 0.6em 0 2em rgba(0, 0, 0, 0.75);
	display: flex;
	flex-direction: column;
	overflow: hidden;
	color: #e5e7eb;
	pointer-events: auto;
	transition: width 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.cae-modal-container.__collapsed {
	width: 3.6em;
	min-width: 3.6em;
}

.cae-drawer-enter-active,
.cae-drawer-leave-active {
	transition: opacity 0.2s ease;
}

.cae-drawer-enter-active .cae-modal-container,
.cae-drawer-leave-active .cae-modal-container {
	transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.cae-drawer-enter-from .cae-modal-container,
.cae-drawer-leave-to .cae-modal-container {
	transform: translateX(-100%);
}

.cae-icon-btn {
	background: transparent;
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #9ca3af;
	font-size: 0.85em;
	width: 2em;
	height: 2em;
	border-radius: 0.3em;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: all 0.15s ease;
}

.cae-icon-btn:hover {
	color: #f6c445;
	background: rgba(246, 196, 69, 0.15);
	border-color: #f6c445;
}

/* Header */
.cae-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.7em 1em;
	background: #1a1e28;
	border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	flex-shrink: 0;
}

.cae-header-title-box {
	display: flex;
	align-items: center;
	gap: 0.6em;
	overflow: hidden;
}

.cae-header-icon {
	font-size: 1.5em;
	flex-shrink: 0;
}

.cae-header-meta {
	display: flex;
	flex-direction: column;
	gap: 0.15em;
	overflow: hidden;
}

.cae-title {
	font-size: 1em;
	font-weight: 700;
	color: #f3f4f6;
	margin: 0;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.cae-id-badge {
	font-size: 0.68em;
	color: #9ca3af;
	font-family: monospace;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.cae-header-quick-controls {
	display: flex;
	align-items: center;
	gap: 0.5em;
	flex-shrink: 0;
}

.cae-close-btn {
	background: transparent;
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #9ca3af;
	font-size: 0.85em;
	width: 2em;
	height: 2em;
	border-radius: 0.3em;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: all 0.15s ease;
}

.cae-close-btn:hover {
	color: #fff;
	background: rgba(239, 68, 68, 0.25);
	border-color: #ef4444;
}

/* Body */
.cae-body {
	flex: 1;
	padding: 0.8em 1em;
	overflow-y: auto;
	display: flex;
	flex-direction: column;
	gap: 0.8em;
}

.cae-card {
	background: #191d27;
	border: 1px solid rgba(255, 255, 255, 0.07);
	border-radius: 0.5em;
	padding: 0.7em 0.9em;
}

.cae-card-title {
	font-size: 0.85em;
	font-weight: 600;
	color: #d1d5db;
	margin-bottom: 0.6em;
}

/* Form grid */
.cae-grid-form {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 0.5em 0.7em;
}

.cae-name-icon-row {
	display: flex;
	gap: 0.5em;
	align-items: flex-end;
}

.cae-name-field {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 0.3em;
}

.cae-icon-field {
	width: 4.5em;
	display: flex;
	flex-direction: column;
	gap: 0.3em;
}

.cae-form-field {
	display: flex;
	flex-direction: column;
	gap: 0.3em;
}

.cae-form-field.__col-span-2 {
	grid-column: 1 / -1;
}

.cae-form-field.__narrow {
	max-width: 7em;
}

.cae-form-field.__full-width {
	grid-column: 1 / -1;
	margin-top: 0.5em;
}

.cae-label {
	font-size: 0.7em;
	color: #9ca3af;
}

.cae-input,
.cae-select {
	background: #12141c;
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.3em;
	padding: 0.4em 0.6em;
	color: #f3f4f6;
	font-size: 0.8em;
	outline: none;
	transition: border-color 0.15s ease;
}

.cae-input:focus,
.cae-select:focus {
	border-color: #3b82f6;
}

.cae-input.__center {
	text-align: center;
	font-size: 1em;
}

.cae-input.__compact {
	padding: 0.25em 0.4em;
	font-size: 0.75em;
}

.cae-input.__code {
	font-family: monospace;
	font-size: 0.75em;
}

/* Mode Switcher Pills */
.cae-mode-pills-row {
	display: flex;
	gap: 0.5em;
	background: #12151e;
	padding: 0.3em;
	border-radius: 0.4em;
	border: 1px solid rgba(255, 255, 255, 0.06);
}

.cae-pill-btn {
	flex: 1;
	padding: 0.5em 0.8em;
	background: transparent;
	border: none;
	border-radius: 0.3em;
	color: #9ca3af;
	font-size: 0.8em;
	font-weight: 600;
	cursor: pointer;
	transition: all 0.15s ease;
}

.cae-pill-btn:hover {
	color: #f3f4f6;
	background: rgba(255, 255, 255, 0.04);
}

.cae-pill-btn.__active {
	background: #2563eb;
	color: #fff;
}

/* Scrubber Card */
.cae-scrubber-card {
	background: #13161f;
	border-color: rgba(59, 130, 246, 0.25);
}

.cae-scrubber-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	font-size: 0.75em;
	margin-bottom: 0.4em;
}

.cae-scrubber-title {
	color: #93c5fd;
	font-weight: 600;
}

.cae-scrubber-timer {
	font-family: monospace;
	color: #d1d5db;
}

.cae-scrubber-row {
	display: flex;
	align-items: center;
	gap: 0.6em;
}

.cae-scrubber-slider {
	flex: 1;
}

/* Timeline Tracks */
.cae-timeline-section {
	display: flex;
	flex-direction: column;
	gap: 0.7em;
}

.cae-tracks-top-bar {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.cae-section-heading {
	font-size: 0.85em;
	font-weight: 700;
	color: #e5e7eb;
}

.cae-add-track-controls {
	display: flex;
	align-items: center;
	gap: 0.5em;
}

.cae-empty-state {
	padding: 1.5em;
	text-align: center;
	background: rgba(255, 255, 255, 0.02);
	border: 1px dashed rgba(255, 255, 255, 0.1);
	border-radius: 0.4em;
	color: #6b7280;
	font-size: 0.8em;
}

.cae-track-card {
	display: flex;
	flex-direction: column;
	gap: 0.7em;
	border-left: 0.25em solid #3b82f6;
}

.cae-track-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.cae-track-title-row {
	display: flex;
	align-items: center;
	gap: 0.8em;
}

.cae-part-badge {
	font-size: 0.8em;
	font-weight: 700;
	background: #1e3a8a;
	color: #bfdbfe;
	padding: 0.2em 0.5em;
	border-radius: 0.3em;
}

.cae-target-mode-toggle {
	display: flex;
	align-items: center;
	gap: 0.8em;
	font-size: 0.72em;
	color: #9ca3af;
}

.cae-radio-label {
	display: flex;
	align-items: center;
	gap: 0.3em;
	cursor: pointer;
}

.cae-track-actions {
	display: flex;
	align-items: center;
	gap: 0.4em;
}

/* Chips Bar */
.cae-keyframes-chips-bar {
	display: flex;
	align-items: center;
	gap: 0.6em;
	padding: 0.4em 0.6em;
	background: #11131a;
	border-radius: 0.3em;
}

.cae-small-label {
	font-size: 0.7em;
	color: #9ca3af;
	white-space: nowrap;
}

.cae-chips-row {
	display: flex;
	flex-wrap: wrap;
	gap: 0.4em;
}

.cae-kf-chip {
	padding: 0.2em 0.5em;
	background: #1e2230;
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.25em;
	color: #d1d5db;
	font-size: 0.7em;
	cursor: pointer;
	transition: all 0.15s ease;
}

.cae-kf-chip:hover {
	border-color: #3b82f6;
	color: #fff;
}

.cae-kf-chip.__selected {
	background: #2563eb;
	border-color: #60a5fa;
	color: #fff;
	font-weight: 700;
}

/* Keyframe Editor Panel */
.cae-kf-editor-panel {
	background: #12151e;
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 0.4em;
	padding: 0.7em 0.8em;
	display: flex;
	flex-direction: column;
	gap: 0.6em;
}

.cae-kf-editor-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	font-size: 0.75em;
	color: #93c5fd;
	border-bottom: 1px solid rgba(255, 255, 255, 0.05);
	padding-bottom: 0.4em;
}

.cae-kf-editor-header-actions {
	display: flex;
	gap: 0.4em;
}

.cae-kf-controls-grid {
	display: grid;
	grid-template-columns: 1fr;
	gap: 0.6em;
}

.cae-control-item {
	display: flex;
	flex-direction: column;
	gap: 0.25em;
}

.cae-control-item.__wide {
	grid-column: 1 / -1;
}

.cae-ci-label-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	font-size: 0.68em;
	color: #9ca3af;
}

.cae-ci-val {
	font-family: monospace;
	color: #f3f4f6;
	font-weight: 600;
}

.cae-ci-hint {
	font-size: 0.85em;
	color: #6b7280;
}

.cae-badge-on {
	background: #059669;
	color: #ecfdf5;
	font-size: 0.85em;
	padding: 0.1em 0.3em;
	border-radius: 0.2em;
	font-weight: 700;
}

.cae-slider-input-row {
	display: flex;
	align-items: center;
	gap: 0.4em;
}

.cae-range {
	flex: 1;
	accent-color: #3b82f6;
	cursor: pointer;
	height: 0.3em;
}

.cae-number-input {
	width: 3.5em;
	background: #0d0f15;
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.25em;
	padding: 0.2em 0.3em;
	color: #f3f4f6;
	font-size: 0.72em;
	text-align: right;
}

.cae-micro-btn {
	background: rgba(255, 255, 255, 0.06);
	border: 1px solid rgba(255, 255, 255, 0.1);
	color: #9ca3af;
	font-size: 0.65em;
	padding: 0.2em 0.4em;
	border-radius: 0.2em;
	cursor: pointer;
}

.cae-micro-btn:hover {
	background: rgba(255, 255, 255, 0.12);
	color: #fff;
}

.cae-sprite-swap-row {
	display: flex;
	align-items: center;
	gap: 0.4em;
}

/* Script Mode */
.cae-script-section {
	display: flex;
	flex-direction: column;
	gap: 0.7em;
}

.cae-card-header-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 0.5em;
}

.cae-script-presets {
	display: flex;
	align-items: center;
	gap: 0.35em;
}

.cae-code-textarea {
	width: 100%;
	background: #0e1118;
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.4em;
	padding: 0.6em;
	color: #a5f3fc;
	font-family: Consolas, Monaco, 'Courier New', monospace;
	font-size: 0.78em;
	line-height: 1.4;
	outline: none;
	resize: vertical;
}

.cae-code-textarea:focus {
	border-color: #3b82f6;
}

.cae-script-help-card {
	margin-top: 0.6em;
	background: rgba(0, 0, 0, 0.25);
	border: 1px solid rgba(255, 255, 255, 0.05);
	border-radius: 0.3em;
	padding: 0.5em 0.7em;
	font-size: 0.7em;
	color: #9ca3af;
	display: flex;
	flex-direction: column;
	gap: 0.3em;
}

.cae-help-title {
	font-weight: 600;
	color: #d1d5db;
}

.cae-help-tags code,
.cae-help-desc code {
	background: rgba(255, 255, 255, 0.08);
	color: #fde047;
	padding: 0.1em 0.3em;
	border-radius: 0.2em;
	font-size: 0.95em;
}

/* Footer */
.cae-footer {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.8em 1.2em;
	background: #1a1e28;
	border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.cae-footer-right {
	display: flex;
	gap: 0.6em;
}

/* General Buttons */
.cae-btn {
	padding: 0.45em 0.9em;
	border-radius: 0.35em;
	font-size: 0.8em;
	font-weight: 600;
	cursor: pointer;
	transition: all 0.15s ease;
	border: 1px solid transparent;
}

.cae-btn.__primary {
	background: #2563eb;
	color: #fff;
}

.cae-btn.__primary:hover {
	background: #1d4ed8;
}

.cae-btn.__secondary {
	background: #272d3d;
	border-color: rgba(255, 255, 255, 0.1);
	color: #d1d5db;
}

.cae-btn.__secondary:hover {
	background: #32394d;
	color: #fff;
}

.cae-btn.__accent {
	background: #059669;
	color: #fff;
}

.cae-btn.__accent:hover {
	background: #047857;
}

.cae-btn.__play {
	background: #16a34a;
	color: #fff;
}

.cae-btn.__play.__active {
	background: #dc2626;
}

.cae-mini-btn {
	padding: 0.25em 0.5em;
	background: rgba(255, 255, 255, 0.07);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.25em;
	color: #d1d5db;
	font-size: 0.7em;
	cursor: pointer;
	transition: all 0.15s ease;
}

.cae-mini-btn:hover {
	background: rgba(255, 255, 255, 0.15);
	color: #fff;
}

.cae-mini-btn.__accent {
	background: #1e3a8a;
	border-color: #3b82f6;
	color: #bfdbfe;
}

.cae-mini-btn.__accent:hover {
	background: #2563eb;
	color: #fff;
}

.cae-mini-btn.__danger:hover {
	background: rgba(239, 68, 68, 0.3);
	border-color: #ef4444;
	color: #fff;
}

.cae-btn-icon {
	width: 1.8em;
	height: 1.8em;
	background: #222736;
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.3em;
	color: #fff;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 0.8em;
}

.cae-btn-icon.__active {
	background: #dc2626;
}

/* Builtin animation notice banner */
.cae-builtin-notice {
	display: flex;
	align-items: flex-start;
	gap: 0.5em;
	padding: 0.55em 0.75em;
	background: rgba(245, 158, 11, 0.12);
	border: 1px solid rgba(245, 158, 11, 0.4);
	border-radius: 0.4em;
	color: #fcd34d;
	font-size: 0.8em;
	line-height: 1.4;
}

.cae-builtin-icon {
	flex-shrink: 0;
	font-size: 1.1em;
}

/* CSP warning for script mode */
.cae-csp-notice {
	padding: 0.5em 0.75em;
	background: rgba(239, 68, 68, 0.1);
	border: 1px solid rgba(239, 68, 68, 0.35);
	border-radius: 0.4em;
	color: #fca5a5;
	font-size: 0.78em;
	line-height: 1.4;
}

/* Duration row with preset buttons */
.cae-duration-row {
	display: flex;
	flex-direction: column;
	gap: 0.35em;
}

.cae-input.__compact-num {
	width: 6em;
}

.cae-duration-presets {
	display: flex;
	flex-wrap: wrap;
	gap: 0.3em;
}

.cae-dur-preset {
	padding: 0.15em 0.45em;
	background: #1e2333;
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.3em;
	color: #9ca3af;
	font-size: 0.75em;
	cursor: pointer;
	transition: all 0.12s ease;
}

.cae-dur-preset:hover {
	background: #2a3050;
	border-color: rgba(246, 196, 69, 0.4);
	color: #f6c445;
}

.cae-dur-preset.__active {
	background: rgba(246, 196, 69, 0.18);
	border-color: #f6c445;
	color: #f6c445;
	font-weight: 600;
}

.cae-field-hint {
	font-size: 0.72em;
	color: #9ca3af;
	margin-top: 0.25em;
	line-height: 1.3;
}
</style>

