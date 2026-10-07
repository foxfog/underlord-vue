import { ref, computed } from 'vue'
import {
	DEFAULT_SCENE_CAMERA_OVERSCAN,
	getSceneCameraOverscan
} from '../../utils/scene/sceneConfig'

/**
 * useStoryCamera — Управление камерой, оверсканом и кинематографическими анимациями сцены
 *
 * Предоставляет функции для запуска анимаций камеры в визуальной новелле:
 * - nod: кивание согласия
 * - shake: покачивание головой / отказ
 * - cough: кашель / чих (спазм с резким наклоном и отдачей)
 * - damage: тряска от удара/урона с красной вспышкой и виньеткой
 * - rumble: глубокая вибрация / землетрясение / шум станков
 * - reset: возврат в нейтральное положение
 */
export function useStoryCamera({ isRestoringGameState } = {}) {
	const activeCameraEffect = ref(null)
	const cameraEffectDuration = ref(0.6)
	const isDamageOverlayActive = ref(false)
	const cameraOverscan = ref(getSceneCameraOverscan() || DEFAULT_SCENE_CAMERA_OVERSCAN)

	let cameraTimeout = null
	let damageOverlayTimeout = null

	/**
	 * Нормализует строковое название эффекта камеры.
	 * Поддерживает синонимы на английском и русском языках.
	 */
	function normalizeCameraEffect(raw) {
		if (!raw || typeof raw !== 'string') return 'nod'
		const key = raw.trim().toLowerCase().replace(/_/g, '-')

		if (['nod', 'agree', 'nod-agree', 'yes', 'kiwok', 'nodding'].includes(key)) {
			return 'nod'
		}
		if (['shake', 'refuse', 'shake-refuse', 'no', 'otkaz', 'head-shake', 'shaking'].includes(key)) {
			return 'shake'
		}
		if (['cough', 'sneeze', 'chih', 'kashel', 'coughing', 'sneezing'].includes(key)) {
			return 'cough'
		}
		if (['damage', 'hurt', 'hit', 'damage-shake', 'uron', 'impact'].includes(key)) {
			return 'damage'
		}
		if (['rumble', 'earthquake', 'heavy-shake', 'quaking', 'vibration'].includes(key)) {
			return 'rumble'
		}
		if (['reset', 'stop', 'clear', 'none', 'neutral'].includes(key)) {
			return 'reset'
		}

		return key
	}

	function getDefaultDuration(effect) {
		switch (effect) {
			case 'nod':
				return 0.6
			case 'shake':
				return 0.55
			case 'cough':
				return 0.6
			case 'damage':
				return 0.65
			case 'rumble':
				return 0.8
			default:
				return 0.6
		}
	}

	function clearCameraTimeouts() {
		if (cameraTimeout) {
			clearTimeout(cameraTimeout)
			cameraTimeout = null
		}
		if (damageOverlayTimeout) {
			clearTimeout(damageOverlayTimeout)
			damageOverlayTimeout = null
		}
	}

	function resetCamera() {
		clearCameraTimeouts()
		activeCameraEffect.value = null
		isDamageOverlayActive.value = false
	}

	/**
	 * Запускает эффект камеры.
	 *
	 * @param {Object} options
	 * @param {string} [options.effect] Название эффекта (nod, shake, cough, damage, rumble, reset)
	 * @param {string} [options.action] Алиас для effect
	 * @param {string} [options.animation] Алиас для effect
	 * @param {number} [options.duration] Длительность в секундах
	 * @param {boolean} [options.damageFlash] Принудительно показать красную виньетку урона
	 * @param {boolean} [options.wait] Ждать ли завершения промиса
	 * @returns {Promise<void>}
	 */
	function playCameraEffect(options = {}) {
		const restoring =
			typeof isRestoringGameState === 'function'
				? isRestoringGameState()
				: (isRestoringGameState?.value ?? false)

		if (restoring) {
			resetCamera()
			return Promise.resolve()
		}

		clearCameraTimeouts()

		const rawEffect = options.effect || options.action || options.animation || 'nod'
		const effect = normalizeCameraEffect(rawEffect)

		if (effect === 'reset') {
			resetCamera()
			return Promise.resolve()
		}

		const parsedDuration =
			typeof options.duration === 'number'
				? options.duration
				: parseFloat(options.duration)
		const duration =
			!isNaN(parsedDuration) && parsedDuration > 0
				? parsedDuration
				: getDefaultDuration(effect)

		// Обновляем оверскан, если передан в параметрах
		if (options.overscan !== undefined && options.overscan !== null) {
			const sc = Number(options.overscan)
			if (!isNaN(sc) && sc >= 1.0) {
				cameraOverscan.value = sc
			}
		}

		// Для сброса предыдущей CSS-анимации сбрасываем значение на мгновение
		activeCameraEffect.value = null
		isDamageOverlayActive.value = false

		return new Promise((resolve) => {
			requestAnimationFrame(() => {
				activeCameraEffect.value = effect
				cameraEffectDuration.value = duration

				const shouldFlashDamage =
					effect === 'damage' || options.damageFlash === true

				if (shouldFlashDamage) {
					isDamageOverlayActive.value = true
				}

				const durationMs = duration * 1000

				cameraTimeout = setTimeout(() => {
					activeCameraEffect.value = null
					cameraTimeout = null
					resolve()
				}, durationMs)

				if (shouldFlashDamage) {
					damageOverlayTimeout = setTimeout(() => {
						isDamageOverlayActive.value = false
						damageOverlayTimeout = null
					}, durationMs)
				}
			})
		})
	}

	/**
	 * Обработчик шага сценария с камерой (type: 'camera' | 'camera-animate')
	 *
	 * @param {Object} step
	 * @returns {Promise<void>}
	 */
	async function handleCameraStep(step) {
		if (!step) return

		const wait = step.wait === true

		if (wait) {
			await playCameraEffect(step)
		} else {
			// Асинхронный запуск: камера анимируется параллельно с речью/текстом
			playCameraEffect(step)
		}
	}

	const cameraEffectClass = computed(() => {
		if (!activeCameraEffect.value) return ''
		return `camera-${activeCameraEffect.value}`
	})

	const cameraStageStyle = computed(() => ({
		'--vn-camera-scale': cameraOverscan.value,
		'--vn-camera-duration': `${cameraEffectDuration.value}s`
	}))

	const cameraDamageStyle = computed(() => ({
		'--vn-camera-duration': `${cameraEffectDuration.value}s`
	}))

	return {
		activeCameraEffect,
		cameraEffectDuration,
		isDamageOverlayActive,
		cameraOverscan,
		cameraEffectClass,
		cameraStageStyle,
		cameraDamageStyle,
		normalizeCameraEffect,
		playCameraEffect,
		resetCamera,
		clearCameraTimeouts,
		handleCameraStep
	}
}
