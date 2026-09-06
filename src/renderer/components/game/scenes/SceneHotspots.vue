<template>
	<transition name="hotspots-fade">
		<div
			v-if="!isInDialogueMode && visibleHotspots.length > 0"
			class="scene-hotspots-container"
			aria-label="Интерактивные переходы и объекты сцены"
		>
			<button
				v-for="hotspot in visibleHotspots"
				:key="hotspot.id"
				class="scene-hotspot"
				:class="{
					'is-locked': hotspot.resolvedStatus === 'locked',
					'is-active': hotspot.resolvedStatus === 'active',
					'is-shaking': shakingHotspots.has(hotspot.id)
				}"
				:style="getHotspotStyle(hotspot)"
				:title="getTooltip(hotspot)"
				@click.stop="onHotspotClick(hotspot)"
			>
				<!-- Пульсирующий ореол для активных маркеров -->
				<span
					v-if="hotspot.resolvedStatus === 'active' && hotspot.pulse !== false"
					class="hotspot-pulse"
				></span>

				<!-- Иконка маркера с оверлеем замка для locked -->
				<div class="hotspot-icon-wrapper">
					<span class="hotspot-icon">{{ getIconSymbol(hotspot.icon) }}</span>
					<span
						v-if="hotspot.resolvedStatus === 'locked'"
						class="hotspot-lock-badge"
						title="Заперто"
					>
						🔒
					</span>
				</div>

				<!-- Текстовая подпись маркера -->
				<span v-if="hotspot.label" class="hotspot-label">
					{{ hotspot.label }}
				</span>
			</button>
		</div>
	</transition>
</template>

<script setup>
import { computed, ref } from 'vue'
import { evaluateExpression } from '../../../utils/expressionEvaluator'

const props = defineProps({
	scene: {
		type: Object,
		default: null
	},
	hotspots: {
		type: Array,
		default: null
	},
	globalData: {
		type: Object,
		default: () => ({})
	},
	isInDialogueMode: {
		type: Boolean,
		default: false
	}
})

const emit = defineEmits(['goto', 'hotspot-click'])

const shakingHotspots = ref(new Set())

const ICON_MAP = {
	door: '🚪',
	gate: '⛩️',
	hatch: '🪜',
	cellar: '🪜',
	ladder: '🪜',
	stairs: '🪜',
	search: '🔍',
	inspect: '🔍',
	chest: '🧰',
	box: '📦',
	talk: '💬',
	chat: '💬',
	exit: '🚪',
	lock: '🔒',
	arrow_up: '⬆️',
	arrow_down: '⬇️',
	arrow_left: '⬅️',
	arrow_right: '➡️'
}

function getIconSymbol(iconName) {
	if (!iconName) return '🚪'
	return ICON_MAP[iconName] || iconName
}

function resolveHotspotStatus(hotspot) {
	if (!hotspot) return 'active'

	// 1. Приоритет дельты из globalData.sceneHotspots (сохранения)
	const sceneId = props.scene?.id
	const delta = props.globalData?.sceneHotspots?.[sceneId]?.[hotspot.id]
	if (delta !== undefined && delta !== null) {
		if (typeof delta === 'string') return delta
		if (typeof delta === 'object' && delta.status) return delta.status
	}

	// 2. Динамическое условие (condition)
	if (hotspot.condition) {
		try {
			const passed = Boolean(
				evaluateExpression(hotspot.condition, {
					global: props.globalData || {},
					character: {}
				})
			)
			return passed ? 'active' : hotspot.fallbackStatus || 'locked'
		} catch (error) {
			console.warn('⚠️ [SceneHotspots] Condition eval error:', hotspot.condition, error)
			return hotspot.fallbackStatus || 'locked'
		}
	}

	// 3. Статичный статус из конфигурации
	return hotspot.status || 'active'
}

const visibleHotspots = computed(() => {
	const sourceList = props.hotspots || props.scene?.hotspots || []
	if (!Array.isArray(sourceList)) return []

	return sourceList
		.map((hotspot) => ({
			...hotspot,
			resolvedStatus: resolveHotspotStatus(hotspot)
		}))
		.filter((hotspot) => hotspot.resolvedStatus !== 'hidden')
})

function getHotspotStyle(hotspot) {
	if (!hotspot.position) return {}
	const pos = hotspot.position
	const style = {}
	if (pos.left !== undefined) style.left = pos.left
	if (pos.top !== undefined) style.top = pos.top
	if (pos.right !== undefined) style.right = pos.right
	if (pos.bottom !== undefined) style.bottom = pos.bottom
	if (pos.transform !== undefined) style.transform = pos.transform
	if (pos.zIndex !== undefined) style.zIndex = pos.zIndex
	return style
}

function getTooltip(hotspot) {
	if (hotspot.title) return hotspot.title
	if (hotspot.resolvedStatus === 'locked') {
		return `${hotspot.label || 'Проход'} (Заперто)`
	}
	return hotspot.label || ''
}

function onHotspotClick(hotspot) {
	const status = hotspot.resolvedStatus
	const sceneId = props.scene?.id

	if (status === 'active') {
		let target = hotspot.target

		// Проверяем сценарные переопределения (mapOverrides), если активен сюжетный диалог/катсцена
		const localMap = props.scene?.localMap || props.globalData?.localMap
		if (localMap && props.globalData?.mapOverrides?.[localMap]) {
			const overrides = props.globalData.mapOverrides[localMap]
			const overrideKey = hotspot.locationId || hotspot.target || hotspot.id
			if (overrides[overrideKey]) {
				target = overrides[overrideKey]
			}
		}

		if (target) {
			emit('goto', target)
		}
		emit('hotspot-click', {
			sceneId,
			hotspot,
			status: 'active'
		})
	} else if (status === 'locked') {
		// Запуск анимации покачивания (shake)
		shakingHotspots.value.add(hotspot.id)
		setTimeout(() => {
			shakingHotspots.value.delete(hotspot.id)
		}, 450)

		emit('hotspot-click', {
			sceneId,
			hotspot,
			status: 'locked'
		})
	}
}
</script>

<style scoped>
/*
 * ПРАВИЛО AGENTS.md: ТОЛЬКО em (никаких px и rem, кроме 1px/2px hairline borders)!
 */
.scene-hotspots-container {
	position: absolute;
	inset: 0;
	pointer-events: none;
	user-select: none;
	z-index: 25;
}

/* Маркер перехода */
.scene-hotspot {
	position: absolute;
	display: inline-flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 0.25em;
	background: none;
	border: none;
	cursor: pointer;
	user-select: none;
	transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
	pointer-events: auto;
}

.scene-hotspot:hover {
	transform: scale(1.08);
}

.scene-hotspot:active {
	transform: scale(0.95);
}

/* Круглая иконка маркера */
.hotspot-icon-wrapper {
	position: relative;
	width: 2.8em;
	height: 2.8em;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(18, 18, 24, 0.9);
	border: 2px solid var(--color-primary, #d4af37);
	border-radius: 50%;
	font-size: 1.35em;
	color: var(--color-primary-light, #f3e5ab);
	box-shadow:
		0 0 1em rgba(212, 175, 55, 0.4),
		inset 0 0 0.5em rgba(212, 175, 55, 0.2);
	backdrop-filter: blur(0.3em);
	transition:
		background-color 0.3s ease,
		border-color 0.3s ease,
		box-shadow 0.3s ease;
}

.hotspot-icon {
	display: inline-block;
	line-height: 1;
}

.scene-hotspot.is-active:hover .hotspot-icon-wrapper {
	background: rgba(212, 175, 55, 0.25);
	border-color: #fef08a;
	box-shadow:
		0 0 1.5em rgba(254, 240, 138, 0.8),
		inset 0 0 0.8em rgba(254, 240, 138, 0.4);
}

/* Стилизация запертого маркера */
.scene-hotspot.is-locked .hotspot-icon-wrapper {
	background: rgba(30, 18, 18, 0.92);
	border-color: #7f1d1d;
	color: #fca5a5;
	box-shadow:
		0 0 0.8em rgba(153, 27, 27, 0.4),
		inset 0 0 0.4em rgba(153, 27, 27, 0.2);
}

.scene-hotspot.is-locked:hover .hotspot-icon-wrapper {
	background: rgba(50, 20, 20, 0.95);
	border-color: #ef4444;
	box-shadow:
		0 0 1.2em rgba(239, 68, 68, 0.6),
		inset 0 0 0.6em rgba(239, 68, 68, 0.3);
}

/* Мини-бейдж замка на иконке */
.hotspot-lock-badge {
	position: absolute;
	top: -0.15em;
	right: -0.15em;
	width: 1.1em;
	height: 1.1em;
	background: #7f1d1d;
	border: 1px solid #ef4444;
	border-radius: 50%;
	font-size: 0.6em;
	display: flex;
	align-items: center;
	justify-content: center;
	box-shadow: 0 0.1em 0.3em rgba(0, 0, 0, 0.8);
}

/* Текстовая подпись */
.hotspot-label {
	padding: 0.25em 0.75em;
	background: rgba(15, 15, 20, 0.9);
	border: 1px solid rgba(212, 175, 55, 0.5);
	border-radius: 0.35em;
	font-family: Kurale, sans-serif;
	font-size: 0.9em;
	font-weight: 600;
	color: #fef3c7;
	text-shadow: 0 0 0.4em rgba(0, 0, 0, 0.8);
	white-space: nowrap;
	box-shadow: 0 0.25em 0.8em rgba(0, 0, 0, 0.6);
	backdrop-filter: blur(0.3em);
	transition:
		background-color 0.25s ease,
		border-color 0.25s ease,
		color 0.25s ease,
		box-shadow 0.25s ease;
}

.scene-hotspot.is-active:hover .hotspot-label {
	background: rgba(24, 24, 32, 0.96);
	border-color: var(--color-primary, #d4af37);
	color: #ffffff;
	box-shadow: 0 0 0.8em rgba(212, 175, 55, 0.4);
}

.scene-hotspot.is-locked .hotspot-label {
	border-color: rgba(153, 27, 27, 0.6);
	color: #fca5a5;
}

.scene-hotspot.is-locked:hover .hotspot-label {
	background: rgba(36, 16, 16, 0.96);
	border-color: #ef4444;
	color: #ffffff;
	box-shadow: 0 0 0.8em rgba(239, 68, 68, 0.4);
}

/* Пульсирующий ореол */
.hotspot-pulse {
	position: absolute;
	top: 0.35em;
	width: 3.5em;
	height: 3.5em;
	border: 1px solid rgba(212, 175, 55, 0.6);
	border-radius: 50%;
	animation: hotspotPulse 2.2s infinite ease-out;
	pointer-events: none;
}

@keyframes hotspotPulse {
	0% {
		transform: scale(0.85);
		opacity: 0.8;
	}
	100% {
		transform: scale(1.6);
		opacity: 0;
	}
}

/* Анимация покачивания (Shake) при попытке взаимодействия с закрытым маркером */
.scene-hotspot.is-shaking {
	animation: hotspotShake 0.45s ease-in-out;
}

@keyframes hotspotShake {
	0%, 100% {
		transform: translateX(0);
	}
	20%, 60% {
		transform: translateX(-0.35em);
	}
	40%, 80% {
		transform: translateX(0.35em);
	}
}

/* Плавное скрытие при диалогах */
.hotspots-fade-enter-active,
.hotspots-fade-leave-active {
	transition: opacity 0.3s ease;
}

.hotspots-fade-enter-from,
.hotspots-fade-leave-to {
	opacity: 0;
}
</style>
