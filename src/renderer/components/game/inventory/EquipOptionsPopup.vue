<template>
	<div v-if="prompt || notice" class="equip-popup-layer">
		<div v-if="prompt" class="equip-popup-backdrop" @click.stop="cancel" @contextmenu.prevent="cancel" />
		<div
			v-if="prompt"
			class="equip-popup"
			:style="popupStyle"
			@click.stop
			@pointerdown.stop
			@contextmenu.prevent.stop
		>
			<div class="equip-popup-title">{{ itemName }}</div>

			<label v-if="prompt.canPair" class="equip-popup-check">
				<input v-model="pair" type="checkbox" />
				<span>Занять оба слота (L и R)</span>
			</label>
			<label v-if="prompt.canOneGrip" class="equip-popup-check">
				<input v-model="oneGrip" type="checkbox" />
				<span>
					Использовать как одноручное
					<em class="equip-popup-penalty">(штраф: {{ debuffText }})</em>
				</span>
			</label>

			<div v-if="plan && !plan.ok" class="equip-popup-error">{{ plan.message }}</div>
			<div v-else-if="conflicts.length" class="equip-popup-conflicts">
				<div>Будет снято, чтобы надеть:</div>
				<ul>
					<li v-for="r in conflicts" :key="r.slot">
						{{ nameOf(r.itemId) }}
						<small>({{ slotLabel(r.slot) }})</small>
					</li>
				</ul>
			</div>

			<div class="equip-popup-actions">
				<button
					class="btn-equip-confirm"
					type="button"
					:disabled="!plan || !plan.ok"
					@click="confirm"
				>
					Надеть
				</button>
				<button class="btn-equip-cancel" type="button" @click="cancel">Отмена</button>
			</div>
		</div>

		<div v-if="notice" class="equip-notice">{{ notice }}</div>
	</div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useEquipPrompt } from '@/composables/useEquipPrompt'
import { useRegisterModal } from '@/composables/useModalStack'
import { describeOneHandedDebuff } from '@/utils/equipmentManager'
import { getSlotLabel } from '@/constants/equipmentSlots'

const props = defineProps({
	itemsData: { type: Object, default: () => ({}) }
})

const { prompt, notice, closePrompt } = useEquipPrompt()

const pair = ref(true)
const oneGrip = ref(false)

watch(
	prompt,
	(p) => {
		pair.value = true
		oneGrip.value = false
		if (!p) return
	},
	{ immediate: true }
)

const options = computed(() => ({
	pair: pair.value,
	oneHandedGrip: oneGrip.value
}))

const plan = computed(() => (prompt.value ? prompt.value.preview(options.value) : null))

const conflicts = computed(() => (plan.value?.ok ? plan.value.removes.filter((r) => r.reason !== 'replace') : []))

const itemName = computed(() => nameOf(prompt.value?.itemId))

const debuffText = computed(() => describeOneHandedDebuff(props.itemsData[prompt.value?.itemId]))

const popupStyle = computed(() => {
	const a = prompt.value?.anchor
	if (!a) return { left: '50%', top: '40%', transform: 'translateX(-50%)' }
	const x = Math.max(0.5, a.x + 0.8)
	const y = Math.max(0.5, a.y + 0.8)
	return {
		left: `min(${x}em, calc(100% - 21em))`,
		top: `min(${y}em, calc(100% - 15em))`
	}
})

function nameOf(id) {
	return props.itemsData[id]?.name || id
}

function slotLabel(slot) {
	return getSlotLabel(slot)
}

function confirm() {
	if (!prompt.value || !plan.value?.ok) return
	prompt.value.confirm(options.value)
}

function cancel() {
	if (prompt.value?.cancel) prompt.value.cancel()
	else closePrompt()
}

useRegisterModal('equip-options-popup', () => !!prompt.value, cancel)
</script>
