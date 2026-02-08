<template>
	<div class="splash-screen">
		<div 
			v-show="currentSection === 0" 
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
			v-show="currentSection === 1" 
			class="section section-1"
			:class="{ '__show': currentSection === 1 }"
		>
			<div class="_box ui-poscen">
				<div class="_title">
					<div class="_name">DarkiFox</div>
				</div>
			</div>
		</div>

		<div 
			v-show="currentSection === 2" 
			class="section section-2"
			:class="{ '__show': currentSection === 2 }"
		>
			<div class="_box ui-poscen">
				<div class="_title">
					<div class="_name">UnderlorD</div>
					<div class="_version">0.1</div>
				</div>
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
	const splashMusic = 'audio/music/Bloodhound Gang - The Bad Touch.mp3'

	// =================== КОНФИГ ===================
	const config = {
		sectionTimes: [1, 1, 1],       // секунды для каждой секции (0 = нет авто)
		controls: {
			keyboard: true,            // включить реакцию на клавиатуру
			mouseClick: false,          // включить реакцию на клик ЛКМ
			anyKey: false,             // true = любая клавиша
			allowedKeys: ['Space', 'Enter', 'ArrowRight'] // если anyKey=false
		}
	}
	// ==============================================

	let timerId = null
	const currentSection = ref(0)

	function goHome() {
		clearTimer()
		removeListeners()
		router.replace('/home')
	}

	function nextSection() {
		clearTimer()
		if (currentSection.value < config.sectionTimes.length - 1) {
			currentSection.value++
			startTimer()
		} else {
			goHome()
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
		store.setMusicFile(splashMusic)
		startTimer()
		addListeners()
	})

	onBeforeUnmount(() => {
		clearTimer()
		removeListeners()
		store.setMusicFile(store.defaultMusicFile)
	})
</script>

