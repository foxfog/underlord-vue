import { ref, watch, nextTick } from 'vue'

export function useScreenshotMode() {
  const screenshotMode = ref(false)

  watch(screenshotMode, (isScreenshotMode) => {
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.toggle('screenshot-mode', isScreenshotMode)
    }
  })

  async function saveWithHiddenOverlays(saveAction) {
    screenshotMode.value = true
    await nextTick()
    await new Promise((resolve) => requestAnimationFrame(resolve))
    try {
      return await saveAction()
    } finally {
      screenshotMode.value = false
    }
  }

  return {
    screenshotMode,
    saveWithHiddenOverlays
  }
}
