import { ref } from 'vue'

export function useConfirmDialog() {
  const confirmVisible = ref(false)
  const confirmTitle = ref('')
  const confirmMessage = ref('')
  let confirmAction = null

  function showConfirm(title, message, action) {
    confirmTitle.value = title
    confirmMessage.value = message
    confirmAction = action
    confirmVisible.value = true
  }

  function onConfirm() {
    confirmVisible.value = false
    if (confirmAction) {
      const action = confirmAction
      confirmAction = null
      action()
    }
  }

  function onCancel() {
    confirmVisible.value = false
    confirmAction = null
  }

  return {
    confirmVisible,
    confirmTitle,
    confirmMessage,
    showConfirm,
    onConfirm,
    onCancel
  }
}
