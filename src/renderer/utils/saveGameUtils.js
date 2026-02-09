/**
 * Утилиты для оптимизированного сохранения/загрузки игры
 * Сохраняем только дельта (изменения от дефолтов)
 */

/**
 * Сравнивает объект с дефолтным и возвращает только измененные значения
 * Исключает объекты которые нельзя сравнивать (sprites, equipment и т.д.)
 */
export function extractDelta(current, defaults, excludeKeys = ['sprites', 'equipment', 'equipmentBySlot']) {
  const delta = {}
  
  // Helper: sanitize values that may contain complex references (e.g., equipment objects)
  function sanitizeForSave(value) {
    if (value === null || typeof value === 'undefined') return value
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
    if (Array.isArray(value)) return value.map(sanitizeForSave)
    if (typeof value === 'object') {
      // If it looks like an equipment/item object with an id, return its id
      if (value.id && (typeof value.id === 'string' || typeof value.id === 'number')) return value.id
      // If it has an 'item' with id, use that id
      if (value.item && value.item.id) return value.item.id
      // Otherwise, shallow-clone simple properties
      const out = {}
      for (const k of Object.keys(value)) {
        const v = value[k]
        // Avoid deep complex structures by picking primitives or ids
        if (v === null || ['string','number','boolean'].includes(typeof v)) {
          out[k] = v
        } else if (v && typeof v === 'object') {
          if (v.id && (typeof v.id === 'string' || typeof v.id === 'number')) out[k] = v.id
          else out[k] = String(v)
        } else {
          out[k] = v
        }
      }
      return out
    }
    return String(value)
  }

  // Specific sanitizer for equipment_slots mapping
  function sanitizeEquipmentSlots(slots) {
    if (!slots || typeof slots !== 'object') return slots
    const out = {}
    for (const s in slots) {
      out[s] = sanitizeForSave(slots[s])
    }
    return out
  }
  
  // Проходим по ключам дефолта
  for (const key in defaults) {
    // Пропускаем исключенные ключи
    if (excludeKeys.includes(key)) {
      continue
    }
    
    const defaultValue = defaults[key]
    let currentValue = current[key]

    // Sanitize specific known complex keys before comparison
    if (key === 'equipment_slots') {
      currentValue = sanitizeEquipmentSlots(currentValue)
    }
    
    // Если значение изменилось от дефолта
    // Use JSON.stringify for comparison on sanitized values
    try {
      if (JSON.stringify(currentValue) !== JSON.stringify(defaultValue)) {
        delta[key] = currentValue
      }
    } catch (err) {
      // As a fallback, store a sanitized version
      delta[key] = sanitizeForSave(currentValue)
    }
  }
  
  return delta
}

/**
 * Извлекает дельту для всех персонажей
 */
export function extractCharacterDataDelta(characterData, characterDefaults) {
  const characterDataDelta = {}
  
  for (const charId in characterData) {
    const defaults = characterDefaults[charId]
    if (!defaults) continue
    
    const delta = extractDelta(characterData[charId], defaults)
    
    // Сохраняем только если есть изменения
    if (Object.keys(delta).length > 0) {
      characterDataDelta[charId] = delta
    }
  }
  
  return characterDataDelta
}

/**
 * Объединяет дефолтные значения с дельтой
 */
export function mergeDeltaWithDefaults(defaults, delta) {
  if (!delta || Object.keys(delta).length === 0) {
    return JSON.parse(JSON.stringify(defaults))
  }
  
  return {
    ...defaults,
    ...delta
  }
}

/**
 * Объединяет дефолтные значения персонажей с дельтой
 */
export function mergeCharacterDataWithDefaults(characterDefaults, characterDataDelta) {
  const merged = {}
  
  for (const charId in characterDefaults) {
    const defaults = characterDefaults[charId]
    const delta = characterDataDelta[charId] || {}
    
    merged[charId] = mergeDeltaWithDefaults(defaults, delta)
  }
  
  return merged
}

/**
 * Создает снимок дефолтных значений для всех персонажей
 * (без sprites, equipment и других больших объектов)
 */
export function createCharacterDefaults(characterData) {
  const defaults = {}
  
  for (const charId in characterData) {
    const char = characterData[charId]
    const charDefaults = {}
    
    // Копируем только простые значения (не объекты со спрайтами)
    for (const key in char) {
      // Пропускаем объекты визуализации
      if (['sprites', 'equipment', 'equipmentBySlot'].includes(key)) {
        continue
      }
      
      // Копируем значение
      charDefaults[key] = JSON.parse(JSON.stringify(char[key]))
    }
    
    defaults[charId] = charDefaults
  }
  
  return defaults
}

/**
 * Извлекает отображаемые свойства персонажей (position, orientation, back, class, scale)
 */
export function extractVisibleCharacterDisplay(visibleCharacters) {
  return visibleCharacters.map(character => ({
    id: character.id,
    position: character.position,
    orientation: character.orientation,
    back: character.back,
    customClass: character.customClass,
    scale: character.scale
  }))
}

/**
 * Восстанавливает отображаемые свойства персонажей из сохраненных данных
 */
export function applyVisibleCharacterDisplay(characters, displayData) {
  if (!displayData || !Array.isArray(displayData)) {
    return characters
  }

  const displayMap = new Map(displayData.map(d => [d.id, d]))

  return characters.map(character => {
    const display = displayMap.get(character.id)
    if (display) {
      return {
        ...character,
        position: display.position,
        orientation: display.orientation,
        back: display.back,
        customClass: display.customClass,
        scale: display.scale
      }
    }
    return character
  })
}

