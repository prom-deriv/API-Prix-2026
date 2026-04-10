import { useState, useEffect } from "react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Card } from "../ui/card"
import { X, AlertTriangle, TrendingUp, TrendingDown, DollarSign } from "lucide-react"
import { getDerivAPI } from "../../lib/deriv-api"
import { useTradingStore } from "../../stores/tradingStore"
import type { ProposalOpenContract } from "../../types/deriv"

interface StopLossTakeProfitModalProps {
  isOpen: boolean
  onClose: () => void
  contractId: number
  contract: ProposalOpenContract
}

export default function StopLossTakeProfitModal({
  isOpen,
  onClose,
  contractId,
  contract,
}: StopLossTakeProfitModalProps) {
  const setContractSLTP = useTradingStore((state) => state.setContractSLTP)
  const getContractSLTP = useTradingStore((state) => state.getContractSLTP)
  const clearContractSLTP = useTradingStore((state) => state.clearContractSLTP)

  const existingSLTP = getContractSLTP(contractId)

  const [stopLoss, setStopLoss] = useState<string>(
    existingSLTP?.stopLoss?.toString() || ""
  )
  const [takeProfit, setTakeProfit] = useState<string>(
    existingSLTP?.takeProfit?.toString() || ""
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      const sltp = getContractSLTP(contractId)
      setStopLoss(sltp?.stopLoss?.toString() || "")
      setTakeProfit(sltp?.takeProfit?.toString() || "")
      setError(null)
    }
  }, [isOpen, contractId, getContractSLTP])

  if (!isOpen) return null

  const stopLossValue = parseFloat(stopLoss) || 0
  const takeProfitValue = parseFloat(takeProfit) || 0
  const currentPrice = contract.bid_price

  // Calculate risk/reward
  const riskAmount = stopLossValue > 0 ? currentPrice - stopLossValue : 0
  const rewardAmount = takeProfitValue > 0 ? takeProfitValue - currentPrice : 0
  const riskRewardRatio = riskAmount > 0 && rewardAmount > 0 ? rewardAmount / riskAmount : 0

  // Validation
  const isStopLossValid = !stopLoss || (stopLossValue > 0 && stopLossValue < currentPrice)
  const isTakeProfitValid = !takeProfit || (takeProfitValue > currentPrice)
  const isFormValid = (isStopLossValid && isTakeProfitValid) && (stopLoss || takeProfit)

  const handleSubmit = async () => {
    if (!isFormValid) {
      setError("Please enter valid Stop Loss and/or Take Profit values")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const api = getDerivAPI()
      
      // Call Deriv API to update contract
      await api.updateContract(contractId, {
        stop_loss: stopLossValue || undefined,
        take_profit: takeProfitValue || undefined,
      })

      // Update local store
      setContractSLTP(
        contractId,
        stopLossValue || undefined,
        takeProfitValue || undefined
      )

      console.log("[StopLossTakeProfit] Updated SL/TP for contract:", contractId)
      onClose()
    } catch (err) {
      console.error("[StopLossTakeProfit] Failed to update:", err)
      setError(
        err instanceof Error ? err.message : "Failed to update Stop Loss/Take Profit"
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemove = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      const api = getDerivAPI()
      
      // Remove SL/TP by sending null values
      await api.updateContract(contractId, {
        stop_loss: null,
        take_profit: null,
      })

      // Clear from store
      clearContractSLTP(contractId)

      console.log("[StopLossTakeProfit] Removed SL/TP for contract:", contractId)
      onClose()
    } catch (err) {
      console.error("[StopLossTakeProfit] Failed to remove:", err)
      setError(
        err instanceof Error ? err.message : "Failed to remove Stop Loss/Take Profit"
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const setPreset = (ratio: number) => {
    // Set preset risk/reward ratio
    const riskAmount = currentPrice * 0.02 // 2% risk as default
    const rewardAmount = riskAmount * ratio
    
    setStopLoss((currentPrice - riskAmount).toFixed(2))
    setTakeProfit((currentPrice + rewardAmount).toFixed(2))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto p-6 m-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Risk Management</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Set Stop Loss & Take Profit
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contract Info */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Contract</span>
            <span className="font-semibold">{contract.display_name}</span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Type</span>
            <span className={`px-2 py-0.5 text-xs rounded ${
              contract.contract_type.includes("CALL") || contract.contract_type.includes("RISE")
                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
            }`}>
              {contract.contract_type}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Current Price</span>
            <span className="font-semibold">${currentPrice.toFixed(2)}</span>
          </div>
        </div>

        {/* Preset Ratios */}
        <div className="mb-6">
          <label className="text-sm font-medium mb-2 block">Quick Presets</label>
          <div className="grid grid-cols-3 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPreset(1)}
            >
              1:1
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPreset(2)}
            >
              1:2
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPreset(3)}
            >
              1:3
            </Button>
          </div>
        </div>

        {/* Stop Loss Input */}
        <div className="mb-6">
          <label className="text-sm font-medium mb-2 block flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-red-500" />
            Stop Loss (Exit if price drops to)
          </label>
          <Input
            type="number"
            step="0.01"
            min="0"
            max={currentPrice}
            value={stopLoss}
            onChange={(e) => setStopLoss(e.target.value)}
            placeholder={`< $${currentPrice.toFixed(2)}`}
            className={!isStopLossValid ? "border-red-500" : ""}
          />
          {stopLossValue > 0 && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Risk: ${riskAmount.toFixed(2)} ({((riskAmount / currentPrice) * 100).toFixed(2)}% of current price)
            </p>
          )}
          {!isStopLossValid && (
            <p className="text-xs text-red-500 mt-1">
              Stop Loss must be less than current price
            </p>
          )}
        </div>

        {/* Take Profit Input */}
        <div className="mb-6">
          <label className="text-sm font-medium mb-2 block flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            Take Profit (Exit if price rises to)
          </label>
          <Input
            type="number"
            step="0.01"
            min={currentPrice}
            value={takeProfit}
            onChange={(e) => setTakeProfit(e.target.value)}
            placeholder={`> $${currentPrice.toFixed(2)}`}
            className={!isTakeProfitValid ? "border-red-500" : ""}
          />
          {takeProfitValue > 0 && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Reward: ${rewardAmount.toFixed(2)} ({((rewardAmount / currentPrice) * 100).toFixed(2)}% of current price)
            </p>
          )}
          {!isTakeProfitValid && (
            <p className="text-xs text-red-500 mt-1">
              Take Profit must be greater than current price
            </p>
          )}
        </div>

        {/* Risk/Reward Display */}
        {stopLossValue > 0 && takeProfitValue > 0 && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Risk/Reward Ratio</span>
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                1:{riskRewardRatio.toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
              For every $1 you risk, you could gain ${riskRewardRatio.toFixed(2)}
            </p>
          </div>
        )}

        {/* Warning */}
        {(stopLossValue > 0 || takeProfitValue > 0) && (
          <div className="mb-6 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-gray-700 dark:text-gray-300">
              <p className="font-medium mb-1">Important Notes:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Your contract will automatically close when SL/TP is hit</li>
                <li>You cannot modify SL/TP once the contract is closed</li>
                <li>Market volatility may cause slippage</li>
              </ul>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {(existingSLTP?.stopLoss || existingSLTP?.takeProfit) && (
            <Button
              variant="outline"
              onClick={handleRemove}
              disabled={isSubmitting}
              className="flex-1"
            >
              Remove SL/TP
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid || isSubmitting}
            className="flex-1"
          >
            <DollarSign className="w-4 h-4 mr-1" />
            {isSubmitting ? "Updating..." : "Apply SL/TP"}
          </Button>
        </div>
      </Card>
    </div>
  )
}
