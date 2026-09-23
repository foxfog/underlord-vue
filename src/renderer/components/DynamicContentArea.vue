<template>
	<div class="dynamic-content-area">
		<!-- Static Header Container (fixed at the top, does not scroll with page content) -->
		<header v-if="headerTitle" class="page-header">
			<div class="page-title">{{ headerTitle }}</div>
		</header>

		<!-- Scrollable Page Content Container -->
		<div class="page-content">
			<Transition name="fade" mode="out-in">
				<!-- Main menu content -->
				<HomeContent v-if="currentView === 'main-menu'" key="main-menu" />

				<!-- Settings content -->
				<div v-else-if="currentView === 'settings'" key="settings" class="settings-wrapper">
					<SettingsContent
						ref="settingsContentRef"
						@saved="onSettingsSaved"
						@reset="onSettingsReset"
						@dirty-change="onSettingsDirtyChange"
					/>
				</div>
				<!-- Saves content (visual placeholder) -->
				<div v-else-if="currentView === 'saves'" key="saves" class="saves-wrapper">
					<SavesContent
						:in-game="inGameContext"
						:initial-tab="savesInitialTab"
						@load-request="(data) => emit('load-request', data)"
						@save-request="(data) => emit('save-request', data)"
						@tab-change="onSavesTabChange"
					/>
				</div>

				<!-- Tests content -->
				<div v-else-if="currentView === 'tests'" key="tests" class="tests-wrapper">
					<TestsContent />
				</div>
			</Transition>

			<!-- Additional content can be added here -->
			<slot></slot>
		</div>
	</div>
</template>

<script setup>
import { computed, watch, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import HomeContent from '@/components/HomeContent.vue'
import SettingsContent from '@/components/settings/SettingsContent.vue'
import SavesContent from '@/components/saves/SavesContent.vue'
import TestsContent from '@/components/tests/TestsContent.vue'

const { t } = useI18n()

const props = defineProps({
	currentView: {
		type: String,
		default: 'main-menu'
	},
	inGameContext: { type: Boolean, default: false },
	savesInitialTab: {
		type: String,
		default: 'load',
		validator: (val) => ['load', 'save'].includes(val)
	}
})

const headerTitle = computed(() => {
	switch (props.currentView) {
		case 'settings':
			return t('mainmenu.settings')
		case 'saves':
			return t('mainmenu.save_load')
		case 'tests':
			return t('mainmenu.test') || 'Тесты'
		default:
			return null
	}
})

const emit = defineEmits([
	'back-to-menu',
	'settings-saved',
	'settings-reset',
	'settings-dirty-change',
	'load-request',
	'save-request',
	'saves-tab-change'
])

const settingsContentRef = ref(null)

const onSavesTabChange = (tab) => {
	emit('saves-tab-change', tab)
}

// Watch for view changes
watch(
	() => props.currentView,
	(newView, oldView) => {
		console.log(`DynamicContentArea: switching from "${oldView}" to "${newView}"`)
	}
)

// Event handlers
const onBackToMenu = () => {
	emit('back-to-menu')
}

const onSettingsSaved = () => {
	emit('settings-saved')
}

const onSettingsReset = () => {
	emit('settings-reset')
}

const onSettingsDirtyChange = (val) => {
	emit('settings-dirty-change', val)
}

// Expose helpers for parent components to control settings
function saveSettingsFromOutside() {
	return settingsContentRef.value?.saveSettings?.()
}

function revertSettingsFromOutside() {
	return settingsContentRef.value?.revertToInitial?.()
}

defineExpose({
	saveSettingsFromOutside,
	revertSettingsFromOutside
})
</script>
