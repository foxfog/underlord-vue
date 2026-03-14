# Реализация закрытия инвентаря через Game Rules Engine

## Проблема
В правиле `toxicGasRule` был экшен `closeModal` для закрытия инвентаря, но его реализация отсутствовала.

## Решение

### 1. Добавили обработку `closeModal` в gameRulesEngine.js

**Файл:** `src/renderer/services/gameRulesEngine.js`

**В функции `executeAction` добавлен case:**
```javascript
case 'closeModal':
  this.closeModal(action);
  break;
```

**Добавлена новая функция `closeModal`:**
```javascript
/**
 * Закрывает модальное окно
 */
closeModal(action) {
  const modalName = action.modal;
  console.log(`📋 Closing modal: ${modalName}`);
  
  if (this.gameState.closeModal) {
    this.gameState.closeModal(modalName);
  } else {
    console.warn(`closeModal callback not available in gameState`);
  }
}
```

### 2. Добавили callback в gameState (Game.vue)

**Файл:** `src/renderer/views/Game.vue`

**В объект `gameState` добавлена функция:**
```javascript
closeModal: (modalName) => {
  // Закрывает модальное окно по имени
  if (modalName === 'inventory') {
    showInventoryModal.value = false
  } else if (modalName === 'stats') {
    showStatsModal.value = false
  } else if (modalName === 'map') {
    showMapModal.value = false
  }
  console.log(`✓ Modal closed: ${modalName}`);
}
```

## Как это работает

1. Срабатывает правило `toxicGasRule` (например, игрок снял маску в локации с газом)
2. Engine выполняет экшен `{ type: 'closeModal', modal: 'inventory' }`
3. Вызывается `executeAction`, который распознает тип `'closeModal'`
4. Функция `closeModal` в engine вызывает `this.gameState.closeModal('inventory')`
5. Callback в Game.vue устанавливает `showInventoryModal.value = false`
6. Инвентарь закрывается ✓

## Поддерживаемые модали
- `'inventory'` - инвентарь
- `'stats'` - статистика
- `'map'` - карта

Можно легко добавить ещё!

## Тестирование
Попробуйте в игре:
1. Откройте инвентарь
2. Снимите маску в локации с токсичным газом
3. Инвентарь должен закрыться перед отправкой на сцену смерти
