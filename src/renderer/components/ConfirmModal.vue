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


