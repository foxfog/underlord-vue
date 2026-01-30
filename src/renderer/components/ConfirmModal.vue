<template>
  <teleport to="body">
    <div v-if="visible" class="confirm-overlay">
      <div class="confirm-box">
        <div class="confirm-title" v-if="title">{{ title }}</div>
        <div class="confirm-message">{{ message }}</div>
        <div class="confirm-actions">
          <button class="btn cancel" @click="onCancel">{{ cancelText }}</button>
          <button class="btn confirm" @click="onConfirm">{{ confirmText }}</button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: '' },
  message: { type: String, required: true },
  confirmText: { type: String, default: 'OK' },
  cancelText: { type: String, default: 'Cancel' }
})

const emit = defineEmits(['confirm', 'cancel'])

function onConfirm() {
  emit('confirm')
}

function onCancel() {
  emit('cancel')
}
</script>

<style scoped>
.confirm-overlay {
  position: fixed;
  left: 0; right: 0; top: 0; bottom: 0;
  background: rgba(0,0,0,0.6);
  display:flex; align-items:center; justify-content:center; z-index:9999;
}
.confirm-box { background:#111; color:#eee; padding:18px; border-radius:8px; width:360px; max-width:90%; box-shadow:0 6px 24px rgba(0,0,0,0.6); border:1px solid #222 }
.confirm-title { font-weight:700; margin-bottom:8px }
.confirm-message { margin-bottom:14px; color:#ccc }
.confirm-actions { display:flex; justify-content:flex-end; gap:8px }
.btn { padding:8px 12px; border-radius:6px; border: none; cursor:pointer }
.btn.cancel { background:#2b2b2b; color:#ddd }
.btn.confirm { background:#1976d2; color:#fff }
</style>
