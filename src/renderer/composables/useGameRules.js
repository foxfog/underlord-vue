/**
 * Composable для работы с Game Rules Engine
 * 
 * Использование в компонентах:
 * const { registerRule, checkRules, startRules, stopRules, stats } = useGameRules(gameState);
 */

import { ref, watch } from 'vue';
import GameRulesEngine from '@/services/gameRulesEngine';

let rulesEngine = null;
let stopWatcher = null; // stores the Vue watcher unsubscribe fn

export function useGameRules(gameState) {
  const stats = ref(null);
  const isRunning = ref(false);

  /**
   * Инициализирует Rules Engine
   */
  const initEngine = () => {
    if (!rulesEngine) {
      rulesEngine = new GameRulesEngine(gameState);
      console.log('🔧 Game Rules Engine инициализирован');
    }
    return rulesEngine;
  };

  /**
   * Регистрирует одно правило
   */
  const registerRule = (rule) => {
    const engine = initEngine();
    engine.registerRule(rule);
  };

  /**
   * Регистрирует массив правил
   */
  const registerRules = (rules) => {
    const engine = initEngine();
    engine.registerRules(rules);
  };

  /**
   * Выполняет проверку всех правил
   */
  const checkRules = () => {
    if (rulesEngine) {
      rulesEngine.checkRules();
      updateStats();
    }
  };

  /**
   * Запускает реактивную проверку правил через Vue watcher.
   * Правила проверяются только при реальном изменении gameState,
   * а не по таймеру — это эффективнее и не нагружает консоль.
   */
  const startRules = () => {
    const engine = initEngine();
    engine.start();
    isRunning.value = true;

    // Stop any existing watcher before creating a new one
    if (stopWatcher) { stopWatcher(); stopWatcher = null; }

    stopWatcher = watch(
      () => gameState,
      () => { if (rulesEngine) rulesEngine.checkRules(); },
      { deep: true }
    );

    return () => { if (stopWatcher) { stopWatcher(); stopWatcher = null; } };
  };

  /**
   * Останавливает проверку правил
   */
  const stopRules = () => {
    if (stopWatcher) { stopWatcher(); stopWatcher = null; }
    if (rulesEngine) {
      rulesEngine.stop();
      isRunning.value = false;
    }
  };

  /**
   * Обновляет статистику
   */
  const updateStats = () => {
    if (rulesEngine) {
      stats.value = rulesEngine.getStats();
    }
  };

  /**
   * Сбрасывает статистику
   */
  const resetStats = () => {
    if (rulesEngine) {
      rulesEngine.resetStats();
      updateStats();
    }
  };

  /**
   * Получает конкретное правило
   */
  const getRule = (ruleId) => {
    if (rulesEngine) {
      return rulesEngine.rules.find(r => r.id === ruleId);
    }
  };

  /**
   * Включает/отключает правило
   */
  const setRuleEnabled = (ruleId, enabled) => {
    const rule = getRule(ruleId);
    if (rule) {
      rule.enabled = enabled;
      console.log(`${enabled ? '✓' : '✗'} Правило "${ruleId}" ${enabled ? 'включено' : 'отключено'}`);
    }
  };

  /**
   * Вручную срабатывает правило
   */
  const triggerRule = (ruleId) => {
    const rule = getRule(ruleId);
    if (rule && rulesEngine) {
      rulesEngine.executeRule(rule);
    }
  };

  /**
   * Получает все правила
   */
  const getAllRules = () => {
    return rulesEngine?.rules || [];
  };

  /**
   * Очищает все правила
   */
  const clearRules = () => {
    if (rulesEngine) {
      rulesEngine.rules = [];
      rulesEngine.resetStats();
      console.log('🗑️ Все правила очищены');
    }
  };

  /**
   * Сбрасывает engine (для перезагрузки сценария)
   */
  const resetEngine = () => {
    if (rulesEngine) {
      rulesEngine.stop();
    }
    rulesEngine = null;
    isRunning.value = false;
  };

  /**
   * Сбрасывает состояния условий без полного уничтожения движка.
   * Вызывать при старте новой игры.
   */
  const resetConditionState = () => {
    if (rulesEngine) {
      rulesEngine.resetConditionState();
    }
  };

  return {
    initEngine,
    registerRule,
    registerRules,
    checkRules,
    startRules,
    stopRules,
    updateStats,
    resetStats,
    getRule,
    setRuleEnabled,
    triggerRule,
    getAllRules,
    clearRules,
    resetEngine,
    resetConditionState,
    stats,
    isRunning
  };
}
