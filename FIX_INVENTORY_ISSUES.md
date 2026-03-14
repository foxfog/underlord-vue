# Исправление ошибок инвентаря

## Проблемы:
1. **Инвентарь закрывается** при снятии или выбросе предмета из экипировки
2. **Дублирование предметов** при снятии одежды из экипировки

## Корневые причины:

### Проблема 1: Закрытие инвентаря
**Файл:** `src/renderer/views/Game.vue`
**Функция:** `handleUnequip`
**Причина:** В начале функции была строка `showInventoryModal.value = false`, которая закрывала модальное окно сразу при разэкипировке.

### Проблема 2: Дублирование предметов
**Причина:** Унequip вызывался дважды при перетаскивании:
1. В `drop` обработчике при перетаскивании из экипировки в инвентарь
2. В `end` обработчике после завершения перетаскивания

Это приводило к двойному добавлению предмета в инвентарь.

## Исправления:

### 1. Удалено закрытие инвентаря (Game.vue)
```javascript
// ДО:
function handleUnequip({ slot, itemId }) {
    showInventoryModal.value = false  // ❌ УДАЛЕНО
    if (!mcCharacter.value?.equipment_slots || !mcCharacter.value?.inventory?.items) return
    ...
}

// ПОСЛЕ:
function handleUnequip({ slot, itemId }) {
    if (!mcCharacter.value?.equipment_slots || !mcCharacter.value?.inventory?.items) return
    ...
}
```

### 2. Удален двойной вызов unequip (InventoryItems.vue)
```javascript
// ДО: В end обработчике вызывался unequip
end: (event) => {
    if (draggedFromType.value === 'slot' && dropWasSuccessful.value) {
        emit('unequip', { ... })  // ❌ УДАЛЕНО - это уже вызывается в drop!
    }
}

// ПОСЛЕ: end обработчик только очищает состояние
end: (event) => {
    // Drop handlers already emit unequip if needed, so we don't need to do it here
    resetItemPosition(target)
    // Reset state only
}
```

### 3. Добавлена логика разэкипировки при выбросе (InventoryContextMenu.vue)
```javascript
// Для предметов из экипировки - сначала разэкипируем
if (currentItemSource.value === 'equipment') {
    const itemDef = props.itemsData[currentItem.value]
    const isStackable = itemDef?.stackable !== false
    emit('unequip', { ... })  // Разэкипировка
}
// Затем выбрасываем
emit('drop', { ... })  // Выброс из инвентаря
```

## Результат:
- ✅ Инвентарь больше не закрывается при снятии/выбросе предметов
- ✅ Предметы не дублируются при снятии из экипировки
- ✅ Правильный порядок операций при выбросе: unequip → drop

## Затронутые файлы:
1. `src/renderer/views/Game.vue` - удаление `showInventoryModal.value = false`
2. `src/renderer/components/game/inventory/InventoryItems.vue` - удаление двойного unequip в end обработчике
3. `src/renderer/components/game/inventory/InventoryContextMenu.vue` - добавление unequip перед drop для экипировки
