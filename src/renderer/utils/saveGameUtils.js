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
  
  // Проходим по ключам дефолта
  for (const key in defaults) {
    // Пропускаем исключенные ключи
    if (excludeKeys.includes(key)) {
      continue
    }
    
    const defaultValue = defaults[key]
    const currentValue = current[key]
    
    // Если значение изменилось от дефолта
    if (JSON.stringify(currentValue) !== JSON.stringify(defaultValue)) {
      delta[key] = currentValue
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
