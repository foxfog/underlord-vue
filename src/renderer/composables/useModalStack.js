import { reactive, watch, onBeforeUnmount, getCurrentInstance } from 'vue'

// Reactive global modal stack singleton (LIFO order)
export const modalStack = reactive([])

/**
 * Pushes a modal to the top of the stack.
 * If the modal ID is already in the stack, it is moved to the top.
 * @param {string} id Unique identifier for the modal
 * @param {Function} close Callback to close the modal
 */
export function pushModal(id, close) {
	if (!id) return
	const existingIndex = modalStack.findIndex((item) => item.id === id)
	if (existingIndex !== -1) {
		modalStack.splice(existingIndex, 1)
	}
	modalStack.push({ id, close })
}

/**
 * Removes a modal with the given ID from the stack.
 * @param {string} id
 */
export function removeModal(id) {
	if (!id) return
	const existingIndex = modalStack.findIndex((item) => item.id === id)
	if (existingIndex !== -1) {
		modalStack.splice(existingIndex, 1)
	}
}

/**
 * Pops and executes the top modal's close handler.
 * @returns {boolean} true if a modal was popped and closed, false if the stack was empty
 */
export function handleEscape() {
	if (modalStack.length === 0) {
		return false
	}
	const top = modalStack.pop()
	if (top && typeof top.close === 'function') {
		top.close()
	}
	return true
}

/**
 * Returns whether there are any open modals in the stack.
 * @returns {boolean}
 */
export function hasModals() {
	return modalStack.length > 0
}

/**
 * Gets the current top modal from the stack.
 * @returns {{ id: string, close: Function } | null}
 */
export function getTopModal() {
	if (modalStack.length === 0) return null
	return modalStack[modalStack.length - 1]
}

/**
 * Clears the modal stack.
 */
export function clearModalStack() {
	modalStack.length = 0
}

/**
 * Composable to automatically register a modal when its visibility is true.
 * @param {string} id Unique identifier
 * @param {import('vue').Ref<boolean> | Function} isVisible Ref or getter function
 * @param {Function} close Callback to close the modal
 */
export function useRegisterModal(id, isVisible, close) {
	const isVisibleGetter = typeof isVisible === 'function' ? isVisible : () => isVisible.value

	const unwatch = watch(
		isVisibleGetter,
		(visible) => {
			if (visible) {
				pushModal(id, close)
			} else {
				removeModal(id)
			}
		},
		{ immediate: true, flush: 'sync' }
	)

	if (getCurrentInstance()) {
		onBeforeUnmount(() => {
			removeModal(id)
			unwatch()
		})
	}

	return {
		unregister: () => {
			removeModal(id)
			unwatch()
		}
	}
}

export function useModalStack() {
	return {
		modalStack,
		pushModal,
		removeModal,
		handleEscape,
		hasModals,
		getTopModal,
		clearModalStack,
		useRegisterModal
	}
}
