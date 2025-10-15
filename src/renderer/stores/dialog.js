// src/renderer/stores/dialog.js
import { defineStore } from 'pinia'
import { loadDialogData } from '@/utils/dialogLoader'

export const useDialogStore = defineStore('dialog', {
  state: () => ({
    // Current dialog being displayed
    currentDialog: null,
    // Current node in the dialog tree
    currentNode: null,
    // Dialog history for backtracking
    history: [],
    // Whether dialog is currently active
    isActive: false,
    // Loaded dialog data
    dialogData: {},
    // Sequential nodes for dialogs without choices
    sequentialNodes: [],
    // Current index in sequential nodes
    sequentialIndex: 0
  }),

  getters: {
    // Get current dialog node
    getCurrentNode: (state) => {
      return state.currentNode
    },
    
    // Check if dialog is active
    isDialogActive: (state) => {
      return state.isActive
    }
  },

  actions: {
    // Load dialog data from JSON
    async loadDialogData(dialogId) {
      if (this.dialogData[dialogId]) {
        return this.dialogData[dialogId]
      }
      
      try {
        const dialogData = await loadDialogData(dialogId)
        if (dialogData) {
          this.dialogData[dialogId] = dialogData
          return dialogData
        }
        return null
      } catch (error) {
        console.error(`Failed to load dialog data for ${dialogId}:`, error)
        return null
      }
    },
    
    // Start a dialog
    async startDialog(dialogId) {
      const dialogData = await this.loadDialogData(dialogId)
      if (!dialogData) {
        console.error(`Dialog ${dialogId} not found`)
        return
      }
      
      this.currentDialog = dialogId
      
      // Check if this is a sequential dialog (has sequence property)
      if (dialogData.sequence && Array.isArray(dialogData.sequence)) {
        // For sequential dialogs, we use a different approach
        this.sequentialNodes = dialogData.sequence
        this.sequentialIndex = 0
        this.currentNode = this.sequentialNodes[0] || null
      } else {
        // For choice-based dialogs
        this.currentNode = dialogData.nodes[dialogData.startNode]
        this.sequentialNodes = []
        this.sequentialIndex = 0
      }
      
      this.history = []
      this.isActive = true
    },
    
    // Move to next sequential node
    nextSequentialNode() {
      if (!this.sequentialNodes.length) {
        return
      }
      
      this.sequentialIndex++
      
      if (this.sequentialIndex < this.sequentialNodes.length) {
        this.currentNode = this.sequentialNodes[this.sequentialIndex]
      } else {
        // End of sequential dialog
        this.endDialog()
      }
    },
    
    // Make a choice in the dialog
    makeChoice(choiceId) {
      if (!this.currentDialog || !this.currentNode) return
      
      // Save current node to history
      this.history.push(this.currentNode)
      
      // Find the choice
      const choice = this.currentNode.choices.find(c => c.id === choiceId)
      if (!choice) return
      
      // Load dialog data to get nodes
      const dialogData = this.dialogData[this.currentDialog]
      if (!dialogData) return
      
      // Move to the next node
      if (choice.nextNode) {
        this.currentNode = dialogData.nodes[choice.nextNode]
      } else {
        // End of dialog branch
        this.endDialog()
      }
    },
    
    // Go back in dialog history
    goBack() {
      if (this.history.length > 0) {
        this.currentNode = this.history.pop()
      }
    },
    
    // End the current dialog
    endDialog() {
      this.currentDialog = null
      this.currentNode = null
      this.history = []
      this.isActive = false
      this.sequentialNodes = []
      this.sequentialIndex = 0
    }
  }
})