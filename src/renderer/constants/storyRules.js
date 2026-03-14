/**
 * Story Rules Configuration
 * 
 * Система правил для игры с читаемым синтаксисом
 * Каждое правило имеет:
 * - id: уникальный идентификатор
 * - name: описательное имя
 * - description: подробное описание что делает правило
 * - enabled: включено ли правило
 * - conditions: массив условий (должны быть ВСЕ истинны)
 * - actions: массив действий для выполнения
 * - once: выполнить только один раз
 * - debounce: минимальный интервал между срабатываниями (мс)
 */

// ============================================
// ПРИМЕР 1: Проверка токсичного газа без маски
// ============================================
export const toxicGasRule = {
  id: 'toxic_gas_no_mask',
  name: 'Смерть от отравления газом',
  description: 'Если игрок в локации с токсичным газом без маски - мгновенная смерть',
  enabled: true,
  triggerMode: 'on-change',  // ← Срабатывает только когда условие ИЗМЕНЯЕТСЯ (false → true)
  debounce: 100,

  conditions: [
    // Условие 1: Маска не надета
    {
      type: 'equipment',
      field: 'mask',
      operator: 'ne',
      value: 'gasmask'
    },
    // Условие 2: Токсичный газ активен
    {
      type: 'variable',
      path: 'global.toxic_gas',
      operator: 'gte',
      value: 1
    },
    // Условие 3: История активна (не в меню)
    {
      type: 'story',
      field: 'isPlaying',
      operator: 'eq',
      value: true
    },
    // Условие 4: НЕ на сцене смерти
    {
      type: 'location',
      field: 'id',
      operator: 'ne',
      value: 'suffocation'
    }
  ],

  actions: [
    {
      type: 'closeModal',
      modal: 'inventory'
    },
    {
      type: 'notification',
      text: '⚠️ Недостаток кислорода!',
      notificationType: 'danger',
      duration: 2000
    },
    {
      type: 'goto',
      target: 'death/suffocation'
    }
  ]
};

// ============================================
// ПРИМЕР 2: Снижение здоровья без оборудования
// ============================================
export const noProtectionRule = {
  id: 'no_protection_damage',
  name: 'Урон от радиации без защиты',
  description: 'Если игрок без защитного костюма на опасной локации - получает урон',
  enabled: false, // Отключено по умолчанию
  debounce: 2000, // Проверяем раз в 2 секунды

  conditions: [
    {
      type: 'equipment',
      field: 'hasItem',
      operator: 'not',
      value: 'hazmat_suit'
    },
    {
      type: 'location',
      field: 'hasAttribute',
      operator: 'has',
      value: 'radioactive'
    }
  ],

  actions: [
    {
      type: 'setVariable',
      path: 'character.mc.health',
      value: 'Math.max(0, character.mc.health - 5)' // Теоретически можно поддержать выражения
    },
    {
      type: 'notification',
      text: '☢️ Радиация наносит урон!',
      notificationType: 'warning',
      duration: 1500
    }
  ]
};

// ============================================
// ПРИМЕР 3: Профилактика - напоминание менять фильтр
// ============================================
export const filterWearingRule = {
  id: 'filter_wearing_warning',
  name: 'Напоминание о замене фильтра',
  description: 'Если износ фильтра выше 80% - показываем предупреждение',
  enabled: true,
  debounce: 5000, // Не чаще чем раз в 5 секунд

  conditions: [
    {
      type: 'variable',
      path: 'character.mc.equipment.mask_filter_wear',
      operator: 'gte',
      value: 0.8
    },
    {
      type: 'variable',
      path: 'character.mc.equipment_slots.mask',
      operator: 'eq',
      value: 'gasmask'
    }
  ],

  actions: [
    {
      type: 'notification',
      text: '⚠️ Фильтр маски изношен!',
      notificationType: 'warning',
      duration: 3000
    }
  ]
};

// ============================================
// ПРИМЕР 4: Кастомное условие - сложная логика
// ============================================
export const customLogicRule = {
  id: 'complex_custom_rule',
  name: 'Пример с кастомной функцией',
  description: 'Демонстрация использования своей функции для проверки',
  enabled: false,

  conditions: [
    {
      type: 'custom',
      check: (gameState) => {
        const health = gameState.character?.mc?.health || 100;
        const isInDanger = gameState.game?.location === 'factory';
        // Если здоровье ниже 30% И находимся на опасной локации
        return health < 30 && isInDanger;
      }
    }
  ],

  actions: [
    {
      type: 'dialogue',
      character: 'mc',
      text: 'Мне нужно найти укрытие... я еле держусь...'
    }
  ]
};

// ============================================
// ПРИМЕР 5: Правило с колбэком
// ============================================
export const healthCriticalRule = {
  id: 'health_critical',
  name: 'Критическое здоровье',
  description: 'Когда здоровье ниже 10% - красный экран эффект',
  enabled: true,
  once: false,
  debounce: 1000,

  conditions: [
    {
      type: 'character',
      field: 'health',
      operator: 'lt',
      value: 10
    },
    {
      type: 'story',
      field: 'isPlaying',
      operator: 'eq',
      value: true
    }
  ],

  actions: [
    {
      type: 'notification',
      text: '🚨 КРИТИЧЕСКОЕ СОСТОЯНИЕ',
      notificationType: 'danger',
      duration: 1000
    }
  ],

  // Пользовательский callback
  onTriggered: (gameState) => {
    console.log('⚠️ Здоровье критически низко!', gameState.character.mc.health);
    // Можно вызвать эффект красного экрана
    // gameState.vfxEngine.redScreen();
  }
};

// ============================================
// ПРИМЕР 6: Условие с несколькими вариантами
// ============================================
export const environmentalRule = {
  id: 'environmental_damage',
  name: 'Урон от окружения',
  description: 'Урон если находимся в нескольких опасных локациях',
  enabled: true,
  debounce: 3000,

  conditions: [
    // Проверяем что находимся в одной из опасных локаций
    {
      type: 'location',
      field: 'current',
      operator: 'in',
      value: ['lava_caves', 'acid_swamp', 'irradiated_zone']
    },
    // И без защиты
    {
      type: 'equipment',
      field: 'mask',
      operator: 'ne',
      value: 'hazmat_mask'
    }
  ],

  actions: [
    {
      type: 'setVariable',
      path: 'character.mc.health',
      value: 'decrement' // Специальное значение
    },
    {
      type: 'notification',
      text: '🔥 Окружение наносит урон!',
      notificationType: 'warning'
    }
  ]
};

// ============================================
// ГЛАВНЫЙ МАССИВ ВСЕХ ПРАВИЛ
// ============================================
export const allStoryRules = [
  // Критические правила
  toxicGasRule,
  healthCriticalRule,

  // Уведомления и напоминания
  filterWearingRule,
  environmentalRule,

  // Примеры расширенного использования
  // noProtectionRule,
  // customLogicRule
];

export default allStoryRules;
