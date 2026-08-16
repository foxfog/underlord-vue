import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref, reactive } from 'vue'
import {
	modalStack,
	pushModal,
	removeModal,
	handleEscape,
	hasModals,
	getTopModal,
	clearModalStack,
	useRegisterModal,
	useModalStack
} from '../useModalStack'

describe('useModalStack', () => {
	beforeEach(() => {
		clearModalStack()
	})

	it('should start with an empty stack', () => {
		expect(hasModals()).toBe(false)
		expect(getTopModal()).toBeNull()
		expect(handleEscape()).toBe(false)
	})

	it('should push and pop modals in LIFO order', () => {
		const closeMap = vi.fn()
		const closeInventory = vi.fn()
		const closeInfo = vi.fn()

		pushModal('map', closeMap)
		expect(hasModals()).toBe(true)
		expect(getTopModal().id).toBe('map')

		pushModal('inventory', closeInventory)
		expect(getTopModal().id).toBe('inventory')

		pushModal('info', closeInfo)
		expect(getTopModal().id).toBe('info')

		// 1st ESC closes info
		const handled1 = handleEscape()
		expect(handled1).toBe(true)
		expect(closeInfo).toHaveBeenCalledTimes(1)
		expect(closeInventory).not.toHaveBeenCalled()
		expect(closeMap).not.toHaveBeenCalled()
		expect(getTopModal().id).toBe('inventory')

		// 2nd ESC closes inventory
		const handled2 = handleEscape()
		expect(handled2).toBe(true)
		expect(closeInventory).toHaveBeenCalledTimes(1)
		expect(closeMap).not.toHaveBeenCalled()
		expect(getTopModal().id).toBe('map')

		// 3rd ESC closes map
		const handled3 = handleEscape()
		expect(handled3).toBe(true)
		expect(closeMap).toHaveBeenCalledTimes(1)
		expect(hasModals()).toBe(false)

		// 4th ESC returns false (stack empty -> Game menu can open)
		const handled4 = handleEscape()
		expect(handled4).toBe(false)
	})

	it('should remove modal by ID when closed manually (e.g. mouse click)', () => {
		const closeMap = vi.fn()
		const closeInventory = vi.fn()

		pushModal('map', closeMap)
		pushModal('inventory', closeInventory)

		// User closes inventory with mouse button
		removeModal('inventory')
		expect(getTopModal().id).toBe('map')

		// Next ESC should close map
		const handled = handleEscape()
		expect(handled).toBe(true)
		expect(closeMap).toHaveBeenCalledTimes(1)
		expect(closeInventory).not.toHaveBeenCalled()
		expect(hasModals()).toBe(false)
	})

	it('should move already existing modal to top of stack when re-pushed', () => {
		const closeMap = vi.fn()
		const closeInventory = vi.fn()

		pushModal('map', closeMap)
		pushModal('inventory', closeInventory)
		expect(getTopModal().id).toBe('inventory')

		// Re-focus/re-open map
		pushModal('map', closeMap)
		expect(getTopModal().id).toBe('map')

		// 1st ESC should close map
		handleEscape()
		expect(closeMap).toHaveBeenCalledTimes(1)
		expect(getTopModal().id).toBe('inventory')
	})

	it('should reactively register and unregister with useRegisterModal', () => {
		const isVisible = ref(false)
		const closeFn = vi.fn(() => {
			isVisible.value = false
		})

		const { unregister } = useRegisterModal('test-modal', isVisible, closeFn)
		expect(hasModals()).toBe(false)

		// Modal opens
		isVisible.value = true
		expect(hasModals()).toBe(true)
		expect(getTopModal().id).toBe('test-modal')

		// ESC closes modal
		const handled = handleEscape()
		expect(handled).toBe(true)
		expect(closeFn).toHaveBeenCalledTimes(1)
		expect(isVisible.value).toBe(false)
		expect(hasModals()).toBe(false)

		// Modal opens again then explicitly unregistered
		isVisible.value = true
		expect(hasModals()).toBe(true)
		unregister()
		expect(hasModals()).toBe(false)
	})

	it('should support getter function in useRegisterModal', () => {
		const state = reactive({ open: false })
		const closeFn = vi.fn(() => {
			state.open = false
		})

		useRegisterModal('getter-modal', () => state.open, closeFn)
		expect(hasModals()).toBe(false)

		state.open = true
		expect(hasModals()).toBe(true)
		expect(getTopModal().id).toBe('getter-modal')

		handleEscape()
		expect(closeFn).toHaveBeenCalledTimes(1)
		expect(state.open).toBe(false)
		expect(hasModals()).toBe(false)
	})

	it('should handle complex multi-modal stacking scenario (Game -> Map -> Inventory -> ItemInfo -> Confirm)', () => {
		const isMapVisible = ref(false)
		const isInventoryVisible = ref(false)
		const isItemInfoVisible = ref(false)
		const isConfirmVisible = ref(false)
		const isMenuVisible = ref(false)

		useRegisterModal('game-menu', isMenuVisible, () => {
			isMenuVisible.value = false
		})
		useRegisterModal('map', isMapVisible, () => {
			isMapVisible.value = false
		})
		useRegisterModal('inventory', isInventoryVisible, () => {
			isInventoryVisible.value = false
		})
		useRegisterModal('item-info', isItemInfoVisible, () => {
			isItemInfoVisible.value = false
		})
		useRegisterModal('confirm', isConfirmVisible, () => {
			isConfirmVisible.value = false
		})

		// User opens map
		isMapVisible.value = true
		// Over map, user opens inventory
		isInventoryVisible.value = true
		// Inside inventory, user opens item info
		isItemInfoVisible.value = true

		expect(modalStack.map((m) => m.id)).toEqual(['map', 'inventory', 'item-info'])

		// 1st ESC: closes item-info
		expect(handleEscape()).toBe(true)
		expect(isItemInfoVisible.value).toBe(false)
		expect(isInventoryVisible.value).toBe(true)
		expect(isMapVisible.value).toBe(true)

		// 2nd ESC: closes inventory
		expect(handleEscape()).toBe(true)
		expect(isInventoryVisible.value).toBe(false)
		expect(isMapVisible.value).toBe(true)

		// 3rd ESC: closes map
		expect(handleEscape()).toBe(true)
		expect(isMapVisible.value).toBe(false)
		expect(hasModals()).toBe(false)

		// 4th ESC: nothing in stack -> returns false (trigger to open menu)
		expect(handleEscape()).toBe(false)

		// Game opens menu
		isMenuVisible.value = true
		expect(hasModals()).toBe(true)
		expect(getTopModal().id).toBe('game-menu')

		// In menu, user triggers confirmation dialog
		isConfirmVisible.value = true
		expect(modalStack.map((m) => m.id)).toEqual(['game-menu', 'confirm'])

		// 5th ESC: cancels confirmation
		expect(handleEscape()).toBe(true)
		expect(isConfirmVisible.value).toBe(false)
		expect(isMenuVisible.value).toBe(true)

		// 6th ESC: closes menu
		expect(handleEscape()).toBe(true)
		expect(isMenuVisible.value).toBe(false)
		expect(hasModals()).toBe(false)
	})
})
