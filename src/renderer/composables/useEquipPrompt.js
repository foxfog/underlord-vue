import { ref, shallowRef } from 'vue'

/**
 * Singleton state of the intermediate Drag&Drop popup ("occupy both slots?", "hold in one hand?",
 * "remove X to equip Y?"). The equipment composable opens it, `EquipOptionsPopup.vue` renders it.
 *
 * Prompt shape:
 *   {
 *     itemId, slot, anchor: { x, y } | null,
 *     canPair, canOneGrip,
 *     preview(options) -> plan,           // live recompute while the checkboxes change
 *     confirm(options),                   // commit equip
 *     cancel()
 *   }
 */
const prompt = shallowRef(null)
const notice = ref(null)

let noticeTimer = null

export function useEquipPrompt() {
	function openPrompt(data) {
		prompt.value = data
	}

	function closePrompt() {
		prompt.value = null
	}

	function showNotice(message) {
		notice.value = message
		if (noticeTimer) clearTimeout(noticeTimer)
		noticeTimer = setTimeout(() => {
			notice.value = null
		}, 3500)
	}

	return { prompt, notice, openPrompt, closePrompt, showNotice }
}
