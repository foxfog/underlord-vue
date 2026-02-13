<template>
	<div class="splash-screen" 
		:style="{ '--transition-duration': config.transitions.duration + 'ms', '--transition-easing': config.transitions.easing }"
		:class="{ '__transitions-disabled': !config.transitions.enabled }"
	>
		<div 
			class="section section-0"
			:class="{ '__show': currentSection === 0 }"
		>
			<div class="_box ui-poscen">
				<div class="_title">
					<h3>Дисклеймер</h3>
				</div>
				<div class="_text-box">
					<p>«Underlord» является художественным произведением. Все события, персонажи, локации и ситуации вымышлены. Любое сходство с реальными людьми, организациями или событиями является случайным.</p>
					<p>Игра может содержать яркий свет, резкие звуки, сцены насилия, упоминания алкоголя или иного контента, неподходящего для некоторых игроков. Рекомендуется играть в осознанном состоянии и с перерывами.</p>
					<p>Разработчик не несёт ответственности за возможный физический, психологический или эмоциональный дискомфорт, полученный в процессе игры. Устанавливая и/или запуская игру, вы соглашаетесь с этими условиями.</p>
					<p>Спасибо, что играете в независимые проекты. Ваш интерес помогает нам создавать новое.</p>
				</div>
			</div>
		</div>

		<div 
			class="section section-1"
			:class="{ '__show': currentSection === 1 }"
		>
			<div class="_box ui-poscen">
				<div class="_title">
					<div class="_desc">Вдохнавлено</div>
					<img class="_logo-image" src="/images/logo-overlord.svg">
				</div>
			</div>
		</div>

		<div 
			class="section section-2"
			:class="{ '__show': currentSection === 2 }"
		>
			<div class="_box ui-poscen">
				<div class="_title">
					<div class="_name">DarkiFox</div>
					<div class="_desc">разработка</div>
				</div>
			</div>
		</div>

		<div 
			class="section section-3"
			:class="{ '__show': currentSection === 3 }"
		>
			<div class="_box ui-poscen">
				<div class="_title _big">
					<div class="_name">UnderlorD</div>
					<div class="_version">0.1</div>
				</div>
			</div>
			<div class="_box _gonext" :class="{ '__hide': hideGonext }">
				Нажмите <b>«Esc»</b> чтобы продолжить
			</div>
		</div>
	</div>
</template>

<script setup>
	import { ref, onMounted, onBeforeUnmount } from 'vue'
	import { useRouter } from 'vue-router'
	import { useSettingsStore } from '@/stores/settings'

	const router = useRouter()
	const store = useSettingsStore()
	const splashMusic = 'audio/music/intro.mp3'
	const leaveSound = 'audio/sound/bellwater.wav'

	// =================== КОНФИГ ===================
	const config = {
		sectionTimes: [9, 6, 6, 0],       // секунды для каждой секции (0 = нет авто)
		transitions: {
			enabled: true,             // включить плавные переходы
			duration: 3000,             // длительность эффекта в мс
			easing: 'ease-in-out'      // функция затемнения
		},
		controls: {
			keyboard: true,            // включить реакцию на клавиатуру
			mouseClick: false,          // включить реакцию на клик ЛКМ
			anyKey: false,             // true = любая клавиша
			allowedKeys: ['Space', 'Enter', 'ArrowRight', 'Escape'] // если anyKey=false
		}
	}
	// ==============================================

	let timerId = null
	let transitionTimerId = null
	const currentSection = ref(-1) // Начинаем с -1, чтобы первая секция тоже анимировалась
	const isTransitioning = ref(false)
	const hideGonext = ref(false) // скрыть _gonext мгновенно при закрытии последней секции

	function playLeaveSound() {
		const common = store.audio.commonVolume / 100
		const sound = store.audio.soundVolume / 100
		const volume = Math.max(0, Math.min(1, common * sound))
		const audio = new Audio(leaveSound)
		audio.volume = volume
		audio.play().catch(() => {})
	}

	function goHome() {
		clearTimer()
		clearTransitionTimer()
		removeListeners()
		playLeaveSound()

		if (config.transitions.enabled && currentSection.value >= 0) {
			// _gonext скрывается мгновенно, затем секция уходит с анимацией
			hideGonext.value = true
			currentSection.value = -1
			
			// Ждем длительность анимации, затем переходим на главную
			transitionTimerId = setTimeout(() => {
				router.replace('/home')
			}, config.transitions.duration)
		} else {
			// Если transitions отключены - переходим сразу
			router.replace('/home')
		}
	}

	function nextSection() {
		if (isTransitioning.value) return
		
		clearTimer()
		clearTransitionTimer()
		
		if (currentSection.value < config.sectionTimes.length - 1) {
			isTransitioning.value = true
			const nextSectionIndex = currentSection.value + 1
			
			if (config.transitions.enabled && currentSection.value >= 0) {
				// Сначала скрываем текущую секцию
				currentSection.value = -1
				
				// Ждем длительность анимации, затем показываем следующую
				transitionTimerId = setTimeout(() => {
					currentSection.value = nextSectionIndex
					isTransitioning.value = false
					startTimer()
				}, config.transitions.duration)
			} else {
				// Для первой секции или если transitions отключены - показываем сразу
				currentSection.value = nextSectionIndex
				isTransitioning.value = false
				startTimer()
			}
		} else {
			goHome()
		}
	}

	function clearTransitionTimer() {
		if (transitionTimerId) {
			clearTimeout(transitionTimerId)
			transitionTimerId = null
		}
	}

	function onKeyDown(e) {
		const { anyKey, allowedKeys } = config.controls
		if (anyKey || allowedKeys.includes(e.code)) {
			nextSection()
		}
	}

	function onClick() {
		nextSection()
	}

	function startTimer() {
		const delay = config.sectionTimes[currentSection.value] * 1000
		if (delay > 0) {
			timerId = setTimeout(nextSection, delay)
		}
	}

	function clearTimer() {
		if (timerId) {
			clearTimeout(timerId)
			timerId = null
		}
	}

	function addListeners() {
		const { keyboard, mouseClick } = config.controls
		if (keyboard) window.addEventListener('keydown', onKeyDown)
		if (mouseClick) window.addEventListener('click', onClick)
	}

	function removeListeners() {
		const { keyboard, mouseClick } = config.controls
		if (keyboard) window.removeEventListener('keydown', onKeyDown)
		if (mouseClick) window.removeEventListener('click', onClick)
	}

	onMounted(() => {
		// Если в настройках включён пропуск заставки — сразу уходим на главную
		if (store.general?.skipSplash) {
			router.replace('/home')
			return
		}

		store.setMusicFile(splashMusic)
		setTimeout(() => {
			currentSection.value = 0
			startTimer()
		}, 100)
		addListeners()
	})

	onBeforeUnmount(() => {
		clearTimer()
		clearTransitionTimer()
		removeListeners()
		store.setMusicFile(store.defaultMusicFile)
	})
</script>

