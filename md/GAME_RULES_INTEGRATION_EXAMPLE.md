<!-- 
ПРИМЕР ИНТЕГРАЦИИ Game Rules Engine в Game.vue

Это примеры того как добавить useGameRules в существующий Game.vue
-->

<template>
	<!-- Ваш существующий код... -->
</template>

<script setup>
	import { ref, onMounted, onBeforeUnmount, reactive } from 'vue'
	// ... другие импорты
	
	// ✅ ДОБАВИТЬ ЭТИ ИМПОРТЫ:
	import { useGameRules } from '@/composables/useGameRules'
	import { allStoryRules } from '@/constants/storyRules'

	// Существующие переменные...
	const visualNovel = ref(null)
	const mcCharacter = ref(null)
	// ... други переменные

	// ✅ ДОБАВИТЬ: Объект игрового статуса для Rules Engine
	const gameState = reactive({
		character: {
			mc: {
				health: 100,
				equipment_slots: {
					mask: null
				},
				// ... другие поля
			}
		},
		game: {
			location: 'city_street',
			toxic_gas: 0,
			activeStory: 'start',
			storyPlaying: true,
			// ... другие поля
		},
		storyEngine: null, // Будет заполнено из visualNovel
		showNotification: null, // Будет заполнено
	})

	// ✅ ДОБАВИТЬ: Инициализация Rules Engine
	const { 
		registerRules, 
		startRules, 
		stopRules, 
		stats,
		setRuleEnabled,
		triggerRule
	} = useGameRules(gameState)

	// ✅ ДОБАВИТЬ: Функции для обновления gameState
	const updateGameState = () => {
		if (visualNovel.value && visualNovel.value.gameState) {
			// Синхронизируем данные
			Object.assign(gameState.character, visualNovel.value.gameState.character || {})
			Object.assign(gameState.game, visualNovel.value.gameState.game || {})
		}
	}

	const showNotification = (options) => {
		// Интегрируем с вашей системой уведомлений
		// Это может быть store, composable, или функция из VisualNovel
		// Пример:
		// store.push({ text: options.text, type: options.notificationType })
		console.log('[Notification]', options)
	}

	// ✅ ДОБАВИТЬ: onMounted
	onMounted(() => {
		// Ждём загрузки VisualNovel
		nextTick(() => {
			// Привязываем методы к gameState
			gameState.storyEngine = visualNovel.value
			gameState.showNotification = showNotification

			// Регистрируем все правила
			registerRules(allStoryRules)

			// Запускаем проверку каждые 100ms
			const stopInterval = startRules(100)

			// Также проверяем при изменении ключевых переменных
			watch(
				() => gameState.character.mc?.equipment_slots?.mask,
				() => {
					console.log('🎭 Изменилась маска')
					updateGameState()
				}
			)

			watch(
				() => gameState.game?.toxic_gas,
				(newVal) => {
					console.log('☢️ Изменён уровень токсичного газа:', newVal)
					updateGameState()
				}
			)

			console.log('✅ Game Rules Engine инициализирован')
		})
	})

	// ✅ ДОБАВИТЬ: onBeforeUnmount
	onBeforeUnmount(() => {
		stopRules()
		console.log('❌ Game Rules Engine остановлен')
	})

	// Существующие методы игры...
	// Не забудьте обновлять gameState когда меняются ключевые значения

	function onCharacterLoaded(character) {
		mcCharacter.value = character
		// ✅ ДОБАВИТЬ: Обновьте gameState
		gameState.character.mc = character
	}

	function handleEquip(item) {
		// ... ваш код
		// ✅ ДОБАВИТЬ: Обновьте gameState
		updateGameState()
	}

	function handleUnequip(slotName) {
		// ... ваш код
		// ✅ ДОБАВИТЬ: Обновьте gameState
		updateGameState()
	}

	// ... другие методы вашей компоненты
</script>

<!--
=============================================================================
АЛЬТЕРНАТИВНЫЙ ПОДХОД: Если вы хотите более лёгкую интеграцию
=============================================================================

Добавьте эту простую версию:

const { registerRules, startRules, stopRules } = useGameRules({
	// Просто передаёте ссылки на нужные переменные
	character: mcCharacter,
	game: { location: 'city_street', toxic_gas: 0 },
	storyEngine: visualNovel
})

onMounted(() => {
	registerRules(allStoryRules)
	startRules(100) // Проверяем каждые 100ms
})

onBeforeUnmount(() => {
	stopRules()
})

=============================================================================
ОТЛАДКА: Посмотреть статистику
=============================================================================

Добавьте в шаблон для отладки:

<div v-if="process.env.NODE_ENV === 'development'" class="debug-panel">
	<h4>Rules Engine Stats</h4>
	<pre>{{ JSON.stringify(stats.value, null, 2) }}</pre>
	<button @click="triggerRule('toxic_gas_no_mask')">
		Test Rule
	</button>
</div>

=============================================================================
ВАЖНО: Порядок операций
=============================================================================

1. Убедитесь что visualNovel загружен и имеет данные персонажа
2. ПОТОМ инициализируйте Rules Engine
3. Обновляйте gameState при важных изменениях данных
4. Используйте debounce в правилах для оптимизации производительности

=============================================================================
ПРИМЕРЫ СОЗДАНИЯ НОВЫХ ПРАВИЛ
=============================================================================

Почитайте GAME_RULES_ENGINE.md в /md папке для полной документации.

Быстрый пример:

// storyRules.js
export const myCustomRule = {
	id: 'my_rule',
	name: 'Моё правило',
	enabled: true,
	conditions: [
		{ type: 'variable', path: 'game.location', operator: 'eq', value: 'factory' }
	],
	actions: [
		{ type: 'notification', text: '⚠️ Вы на фабрике!' }
	]
}

// Добавьте в allStoryRules массив:
export const allStoryRules = [
	toxicGasRule,
	myCustomRule,  // ← новое правило
	// ...
]

=============================================================================
-->
