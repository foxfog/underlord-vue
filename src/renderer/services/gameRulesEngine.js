/**
 * Game Rules Engine
 * Система управления условиями и действиями в игре
 * 
 * Примеры правил:
 * - Проверка статуса здоровья
 * - Проверка оборудования в определённых локациях
 * - Срабатывание событий при изменении переменных
 * - Форсированные редиректы при невозможных состояниях
 */

class GameRulesEngine {
  constructor(gameState) {
    this.gameState = gameState;
    this.rules = [];
    this.ruleHistory = new Map(); // Для отслеживания срабатывания
    this.ruleConditionState = new Map(); // Для отслеживания изменения условий (false → true)
    this.isRunning = false;
  }

  /**
   * Регистрирует правило в системе
   * @param {Object} rule - Объект правила
   */
  registerRule(rule) {
    if (!rule.id) {
      throw new Error('Каждое правило должно иметь уникальный id');
    }
    this.rules.push({
      ...rule,
      lastTriggered: null,
      triggerCount: 0
    });
  }

  /**
   * Регистрирует несколько правил сразу
   * @param {Array<Object>} rules - Массив правил
   */
  registerRules(rules) {
    rules.forEach(rule => this.registerRule(rule));
  }

  /**
   * Главный цикл проверки всех правил
   * Должен вызываться регулярно (например, каждый кадр или по таймеру)
   */
  checkRules() {
    if (!this.isRunning) return;

    const triggeredRules = [];

    for (const rule of this.rules) {
      // Пропускаем отключённые правила
      if (!rule.enabled) continue;

      // Проверяем условия
      const conditionsMet = this.evaluateConditions(rule.conditions);
      const previousState = this.ruleConditionState.get(rule.id) || false;
      
      // Определяем срабатывание в зависимости от triggerMode
      let shouldTrigger = false;
      
      if (rule.triggerMode === 'on-change') {
        // Срабатываем только когда условие ИЗМЕНИЛОСЬ (false → true)
        shouldTrigger = conditionsMet && !previousState;
      } else {
        // По умолчанию (mode 'always'): срабатываем каждый раз когда условие истинно
        shouldTrigger = conditionsMet;
      }
      
      // Сохраняем текущее состояние для следующей проверки
      this.ruleConditionState.set(rule.id, conditionsMet);
      
      if (shouldTrigger) {
        triggeredRules.push(rule);
      }
    }

    // Выполняем действия
    for (const rule of triggeredRules) {
      this.executeRule(rule);
    }
  }

  /**
   * Проверяет условия правила
   * @param {Array<Object>} conditions - Массив условий
   * @returns {boolean}
   */
  evaluateConditions(conditions) {
    if (!conditions || conditions.length === 0) return true;

    return conditions.every(condition => this.evaluateCondition(condition));
  }

  /**
   * Проверяет одно условие
   * @param {Object} condition - Объект условия
   * @returns {boolean}
   */
  evaluateCondition(condition) {
    const { type, path, operator, value, field, not = false } = condition;

    let result = false;

    switch (type) {
      case 'variable':
        result = this.evaluateVariableCondition(path, operator, value);
        break;

      case 'location':
        result = this.evaluateLocationCondition(field, operator, value);
        break;

      case 'story':
        result = this.evaluateStoryCondition(field, operator, value);
        break;

      case 'character':
        result = this.evaluateCharacterCondition(field, operator, value);
        break;

      case 'equipment':
        result = this.evaluateEquipmentCondition(field, operator, value);
        break;

      case 'custom':
        // Для кастомных функций-проверок
        result = condition.check(this.gameState);
        break;

      default:
        console.warn(`Неизвестный тип условия: ${type}`);
        return false;
    }

    return not ? !result : result;
  }

  /**
   * Проверка переменной по пути: "character.mc.health"
   */
  evaluateVariableCondition(path, operator, value) {
    const actualValue = this.getValueByPath(path);
    return this.compareValues(actualValue, operator, value);
  }

  /**
   * Проверка условий локации
   */
  evaluateLocationCondition(field, operator, value) {
    const location = this.gameState.game?.currentLocation || this.gameState.game?.location;

    if (field === 'current' || field === 'id' || !field) {
      return this.compareValues(location, operator, value);
    }

    if (field === 'hasAttribute') {
      return (location?.attributes || []).includes(value);
    }

    return false;
  }

  /**
   * Проверка статуса истории
   */
  evaluateStoryCondition(field, operator, value) {
    const story = this.gameState.game?.activeStory;

    if (field === 'id' || field === 'active') {
      return this.compareValues(story, operator, value);
    }

    if (field === 'isPlaying') {
      return this.gameState.game?.storyPlaying === value;
    }

    return false;
  }

  /**
   * Проверка статуса персонажа
   */
  evaluateCharacterCondition(field, operator, value) {
    const character = this.gameState.character?.mc;
    if (!character) return false;

    if (field === 'health' || field === 'hp') {
      return this.compareValues(character.health || character.hp, operator, value);
    }

    if (field === 'isDead') {
      return (character.health || character.hp) <= 0;
    }

    return false;
  }

  /**
   * Проверка оборудования
   */
  evaluateEquipmentCondition(field, operator, value) {
    const equipment = this.gameState.character?.mc?.equipment_slots || {};

    if (field === 'mask') {
      return this.compareValues(equipment.mask, operator, value);
    }

    if (field === 'hasItem') {
      const hasItem = Object.values(equipment).includes(value);
      return operator === 'has' ? hasItem : !hasItem;
    }

    return false;
  }

  /**
   * Получает значение по пути "character.mc.equipment_slots.mask"
   */
  getValueByPath(path) {
    if (!path) return undefined;

    const parts = path.split('.');
    let current = this.gameState;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Сравнивает значения с различными операторами
   */
  compareValues(actual, operator, expected) {
    switch (operator) {
      case 'eq':
      case '=':
      case '==':
        return actual === expected;

      case 'ne':
      case '!=':
        return actual !== expected;

      case 'gt':
      case '>':
        return actual > expected;

      case 'gte':
      case '>=':
        return actual >= expected;

      case 'lt':
      case '<':
        return actual < expected;

      case 'lte':
      case '<=':
        return actual <= expected;

      case 'in':
        return Array.isArray(expected) ? expected.includes(actual) : false;

      case 'nin':
      case 'not-in':
        return Array.isArray(expected) ? !expected.includes(actual) : true;

      case 'contains':
        return String(actual).includes(String(expected));

      case 'startsWith':
        return String(actual).startsWith(String(expected));

      case 'endsWith':
        return String(actual).endsWith(String(expected));

      case 'exists':
        return actual !== undefined && actual !== null;

      case 'empty':
        return !actual || actual.length === 0;

      default:
        console.warn(`Неизвестный оператор: ${operator}`);
        return false;
    }
  }

  /**
   * Выполняет правило (все его действия)
   */
  executeRule(rule) {
    // Проверка на дублирование срабатывания
    if (rule.once && rule.triggerCount > 0) {
      return;
    }

    // Проверка debounce (не срабатывать чаще чем через N мс)
    if (rule.debounce && rule.lastTriggered) {
      const timeSinceLastTrigger = Date.now() - rule.lastTriggered;
      if (timeSinceLastTrigger < rule.debounce) {
        return;
      }
    }

    console.log(`✓ Срабатывает правило: ${rule.id} (${rule.name})`);

    rule.lastTriggered = Date.now();
    rule.triggerCount++;

    // Выполняем все действия
    for (const action of rule.actions) {
      this.executeAction(action);
    }

    // Вызываем callback если указан
    if (rule.onTriggered) {
      rule.onTriggered(this.gameState);
    }
  }

  /**
   * Выполняет одно действие
   */
  executeAction(action) {
    const { type, target, value, ...params } = action;

    switch (type) {
      case 'goto':
        console.log(`🎯 RuleEngine: Calling goto(${target})`, { hasGoto: !!this.gameState.storyEngine?.goto, storyEngine: this.gameState.storyEngine })
        if (this.gameState.storyEngine?.goto) {
          this.gameState.storyEngine.goto(target)
        } else {
          console.error('❌ storyEngine.goto is not available')
        }
        break;

      case 'setVariable':
        this.setValueByPath(action.path, action.value);
        break;

      case 'notification':
        this.showNotification(action);
        break;

      case 'closeModal':
        this.closeModal(action);
        break;

      case 'dialogue':
        this.triggerDialogue(action);
        break;

      case 'endStory':
        this.gameState.storyEngine?.endStory();
        break;

      case 'restartStory':
        this.gameState.storyEngine?.restartStory(action.storyId);
        break;

      case 'callback':
        if (typeof action.callback === 'function') {
          action.callback(this.gameState);
        }
        break;

      case 'log':
        console.log('[GameRule]', action.message);
        break;

      default:
        console.warn(`Неизвестное действие: ${type}`);
    }
  }

  /**
   * Устанавливает значение по пути
   */
  setValueByPath(path, value) {
    const parts = path.split('.');
    const lastPart = parts.pop();
    let current = this.gameState;

    for (const part of parts) {
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part];
    }

    current[lastPart] = value;
    console.log(`📝 Переменная установлена: ${path} = ${value}`);
  }

  /**
   * Показывает уведомление игроку
   */
  showNotification(action) {
    // Это должна быть функция из вашей игры
    if (this.gameState.showNotification) {
      this.gameState.showNotification(action);
    }
  }

  /**
   * Триггерит диалог
   */
  triggerDialogue(action) {
    if (this.gameState.storyEngine?.showDialogue) {
      this.gameState.storyEngine.showDialogue(action);
    }
  }

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

  /**
   * Запускает систему проверки
   */
  start() {
    this.isRunning = true;
    console.log('🎮 Game Rules Engine запущен');
  }

  /**
   * Останавливает систему проверки
   */
  stop() {
    this.isRunning = false;
    console.log('🎮 Game Rules Engine остановлен');
  }

  /**
   * Получает статистику по правилам
   */
  getStats() {
    return this.rules.map(rule => ({
      id: rule.id,
      name: rule.name,
      triggerCount: rule.triggerCount,
      lastTriggered: rule.lastTriggered,
      enabled: rule.enabled
    }));
  }

  /**
   * Сброс статистики
   */
  resetStats() {
    this.rules.forEach(rule => {
      rule.triggerCount = 0;
      rule.lastTriggered = null;
    });
  }

  /**
   * Сбрасывает отслеживаемые состояния условий (on-change).
   * Нужно вызывать при старте новой игры, чтобы правила могли
   * сработать снова с нуля.
   */
  resetConditionState() {
    this.ruleConditionState.clear();
    this.ruleHistory.clear();
    this.resetStats();
    console.log('🔄 Game Rules Engine: condition state reset');
  }
}


export default GameRulesEngine;
