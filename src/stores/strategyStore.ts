import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Strategy, StrategyRule, StrategyCondition } from "../types/deriv"
import { generateId } from "../lib/utils"

interface StrategyState {
  strategies: Strategy[]
  activeStrategyId: string | null
  
  // Actions
  createStrategy: (name: string, symbol: string) => Strategy
  updateStrategy: (id: string, updates: Partial<Strategy>) => void
  deleteStrategy: (id: string) => void
  setActiveStrategy: (id: string | null) => void
  
  // Rule management
  addRule: (strategyId: string) => StrategyRule
  updateRule: (strategyId: string, ruleId: string, updates: Partial<StrategyRule>) => void
  deleteRule: (strategyId: string, ruleId: string) => void
  
  // Condition management
  addCondition: (strategyId: string, ruleId: string) => StrategyCondition
  updateCondition: (
    strategyId: string,
    ruleId: string,
    conditionId: string,
    updates: Partial<StrategyCondition>
  ) => void
  deleteCondition: (strategyId: string, ruleId: string, conditionId: string) => void
  
  // Helpers
  getStrategyById: (id: string) => Strategy | undefined
  getActiveStrategy: () => Strategy | undefined
}

const createDefaultCondition = (): StrategyCondition => ({
  id: generateId(),
  field: "price",
  operator: "greater_than",
  value: 0,
})

const createDefaultRule = (): StrategyRule => ({
  id: generateId(),
  conditions: [createDefaultCondition()],
  logicalOperator: "AND",
  action: {
    contract_type: "CALL",
    amount: 10,
    basis: "stake",
    duration: 5,
    duration_unit: "t",
  },
  enabled: true,
})

export const useStrategyStore = create<StrategyState>()(
  persist(
    (set, get) => ({
      strategies: [],
      activeStrategyId: null,

      createStrategy: (name, symbol) => {
        const newStrategy: Strategy = {
          id: generateId(),
          name,
          symbol,
          rules: [createDefaultRule()],
          isActive: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }

        set((state) => ({
          strategies: [...state.strategies, newStrategy],
        }))

        return newStrategy
      },

      updateStrategy: (id, updates) => {
        set((state) => ({
          strategies: state.strategies.map((strategy) =>
            strategy.id === id
              ? { ...strategy, ...updates, updatedAt: Date.now() }
              : strategy
          ),
        }))
      },

      deleteStrategy: (id) => {
        set((state) => ({
          strategies: state.strategies.filter((s) => s.id !== id),
          activeStrategyId: state.activeStrategyId === id ? null : state.activeStrategyId,
        }))
      },

      setActiveStrategy: (id) => {
        set({ activeStrategyId: id })
      },

      addRule: (strategyId) => {
        const newRule = createDefaultRule()

        set((state) => ({
          strategies: state.strategies.map((strategy) =>
            strategy.id === strategyId
              ? { ...strategy, rules: [...strategy.rules, newRule], updatedAt: Date.now() }
              : strategy
          ),
        }))

        return newRule
      },

      updateRule: (strategyId, ruleId, updates) => {
        set((state) => ({
          strategies: state.strategies.map((strategy) =>
            strategy.id === strategyId
              ? {
                  ...strategy,
                  rules: strategy.rules.map((rule) =>
                    rule.id === ruleId ? { ...rule, ...updates } : rule
                  ),
                  updatedAt: Date.now(),
                }
              : strategy
          ),
        }))
      },

      deleteRule: (strategyId, ruleId) => {
        set((state) => ({
          strategies: state.strategies.map((strategy) =>
            strategy.id === strategyId
              ? {
                  ...strategy,
                  rules: strategy.rules.filter((rule) => rule.id !== ruleId),
                  updatedAt: Date.now(),
                }
              : strategy
          ),
        }))
      },

      addCondition: (strategyId, ruleId) => {
        const newCondition = createDefaultCondition()

        set((state) => ({
          strategies: state.strategies.map((strategy) =>
            strategy.id === strategyId
              ? {
                  ...strategy,
                  rules: strategy.rules.map((rule) =>
                    rule.id === ruleId
                      ? { ...rule, conditions: [...rule.conditions, newCondition] }
                      : rule
                  ),
                  updatedAt: Date.now(),
                }
              : strategy
          ),
        }))

        return newCondition
      },

      updateCondition: (strategyId, ruleId, conditionId, updates) => {
        set((state) => ({
          strategies: state.strategies.map((strategy) =>
            strategy.id === strategyId
              ? {
                  ...strategy,
                  rules: strategy.rules.map((rule) =>
                    rule.id === ruleId
                      ? {
                          ...rule,
                          conditions: rule.conditions.map((condition) =>
                            condition.id === conditionId
                              ? { ...condition, ...updates }
                              : condition
                          ),
                        }
                      : rule
                  ),
                  updatedAt: Date.now(),
                }
              : strategy
          ),
        }))
      },

      deleteCondition: (strategyId, ruleId, conditionId) => {
        set((state) => ({
          strategies: state.strategies.map((strategy) =>
            strategy.id === strategyId
              ? {
                  ...strategy,
                  rules: strategy.rules.map((rule) =>
                    rule.id === ruleId
                      ? {
                          ...rule,
                          conditions: rule.conditions.filter(
                            (condition) => condition.id !== conditionId
                          ),
                        }
                      : rule
                  ),
                  updatedAt: Date.now(),
                }
              : strategy
          ),
        }))
      },

      getStrategyById: (id) => {
        return get().strategies.find((s) => s.id === id)
      },

      getActiveStrategy: () => {
        const { strategies, activeStrategyId } = get()
        return activeStrategyId ? strategies.find((s) => s.id === activeStrategyId) : undefined
      },
    }),
    {
      name: "promo-trade-strategies",
    }
  )
)

export default useStrategyStore