import { useState } from "react"
import { Button } from "../ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { TrendingUp, TrendingDown, DollarSign, Clock, AlertTriangle } from "lucide-react"
import { formatCurrency } from "../../lib/utils"

export interface TradingSetup {
  stake: number
  prediction: "UP" | "DOWN"
  duration: number // in seconds
}

interface TradingSetupModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (setup: TradingSetup) => void
  currentBalance: number
  currentPrice: number
  symbol: string
}

const STAKE_OPTIONS = [5, 10, 25, 50, 100]
const DURATION_OPTIONS = [
  { value: 30, label: "30s" },
  { value: 60, label: "1m" },
  { value: 120, label: "2m" },
]

export default function TradingSetupModal({
  isOpen,
  onClose,
  onConfirm,
  currentBalance,
  currentPrice,
  symbol,
}: TradingSetupModalProps) {
  const [stake, setStake] = useState(10)
  const [prediction, setPrediction] = useState<"UP" | "DOWN">("UP")
  const [duration, setDuration] = useState(60)

  if (!isOpen) return null

  const handleConfirm = () => {
    if (stake > currentBalance) {
      alert(`Insufficient balance! You have ${formatCurrency(currentBalance)} available.`)
      return
    }
    onConfirm({ stake, prediction, duration })
    onClose()
  }

  const potentialProfit = stake * 1.85 // 85% payout
  const potentialLoss = stake

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <Card
        className="w-full max-w-lg shadow-2xl"
        style={{
          backgroundColor: "#FFFFFF",
          border: "3px solid #0EA5E9",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-2xl font-bold" style={{ color: "#0C4A6E" }}>
            🏄‍♂️ Start Your Surf Session
          </CardTitle>
          <div className="text-sm text-muted-foreground">
            <div className="mt-2 space-y-1">
              <div className="text-sm font-medium" style={{ color: "#6B7280" }}>
                {symbol} • Current Price: <span className="font-bold" style={{ color: "#0EA5E9" }}>{currentPrice.toFixed(4)}</span>
              </div>
              <div className="text-sm" style={{ color: "#6B7280" }}>
                Available Balance: <span className="font-bold" style={{ color: "#10B981" }}>{formatCurrency(currentBalance)}</span>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Stake Selection */}
          <div>
            <label className="block text-sm font-medium mb-3" style={{ color: "#0C4A6E" }}>
              <DollarSign className="inline h-4 w-4 mr-1" />
              Select Stake Amount
            </label>
            <div className="grid grid-cols-5 gap-2">
              {STAKE_OPTIONS.map((amount) => (
                <button
                  key={amount}
                  onClick={() => setStake(amount)}
                  disabled={amount > currentBalance}
                  className="py-3 px-2 rounded-lg font-medium text-sm transition-all"
                  style={{
                    backgroundColor: stake === amount ? "#0EA5E9" : "#F3F4F6",
                    color: stake === amount ? "#FFFFFF" : amount > currentBalance ? "#9CA3AF" : "#0C4A6E",
                    border: stake === amount ? "2px solid #0284C7" : "2px solid transparent",
                    cursor: amount > currentBalance ? "not-allowed" : "pointer",
                    opacity: amount > currentBalance ? 0.5 : 1,
                  }}
                >
                  ${amount}
                </button>
              ))}
            </div>
          </div>

          {/* Prediction Direction */}
          <div>
            <label className="block text-sm font-medium mb-3" style={{ color: "#0C4A6E" }}>
              Predict Market Direction
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPrediction("UP")}
                className="py-4 px-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2"
                style={{
                  backgroundColor: prediction === "UP" ? "#10B981" : "#F0FDF4",
                  color: prediction === "UP" ? "#FFFFFF" : "#065F46",
                  border: prediction === "UP" ? "3px solid #059669" : "2px solid #10B981",
                  transform: prediction === "UP" ? "scale(1.05)" : "scale(1)",
                }}
              >
                <TrendingUp className="h-6 w-6" />
                UP ⬆️
              </button>
              <button
                onClick={() => setPrediction("DOWN")}
                className="py-4 px-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2"
                style={{
                  backgroundColor: prediction === "DOWN" ? "#EF4444" : "#FEF2F2",
                  color: prediction === "DOWN" ? "#FFFFFF" : "#991B1B",
                  border: prediction === "DOWN" ? "3px solid #DC2626" : "2px solid #EF4444",
                  transform: prediction === "DOWN" ? "scale(1.05)" : "scale(1)",
                }}
              >
                <TrendingDown className="h-6 w-6" />
                DOWN ⬇️
              </button>
            </div>
          </div>

          {/* Duration Selection */}
          <div>
            <label className="block text-sm font-medium mb-3" style={{ color: "#0C4A6E" }}>
              <Clock className="inline h-4 w-4 mr-1" />
              Session Duration
            </label>
            <div className="grid grid-cols-3 gap-2">
              {DURATION_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setDuration(option.value)}
                  className="py-3 px-4 rounded-lg font-medium transition-all"
                  style={{
                    backgroundColor: duration === option.value ? "#0EA5E9" : "#F3F4F6",
                    color: duration === option.value ? "#FFFFFF" : "#0C4A6E",
                    border: duration === option.value ? "2px solid #0284C7" : "2px solid transparent",
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Profit/Loss Summary */}
          <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: "#F0F9FF", border: "2px solid #BFDBFE" }}>
            <div className="flex justify-between items-center text-sm">
              <span style={{ color: "#6B7280" }}>Potential Profit:</span>
              <span className="font-bold" style={{ color: "#10B981" }}>+{formatCurrency(potentialProfit)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span style={{ color: "#6B7280" }}>Potential Loss:</span>
              <span className="font-bold" style={{ color: "#EF4444" }}>-{formatCurrency(potentialLoss)}</span>
            </div>
            <div className="flex justify-between items-center text-sm pt-2 border-t" style={{ borderColor: "#BFDBFE" }}>
              <span className="font-medium" style={{ color: "#0C4A6E" }}>Payout Rate:</span>
              <span className="font-bold" style={{ color: "#0EA5E9" }}>185%</span>
            </div>
          </div>

          {/* Warning */}
          <div className="rounded-lg p-3 flex items-start gap-2" style={{ backgroundColor: "#FEF3C7", border: "1px solid #FCD34D" }}>
            <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: "#F59E0B" }} />
            <div className="text-xs" style={{ color: "#92400E" }}>
              <strong>Surf Mode:</strong> This is a session where your score will be converted to profit/loss based on your prediction accuracy.
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 rounded-xl"
              style={{
                backgroundColor: "#FFFFFF",
                border: "2px solid #D1D5DB",
                color: "#6B7280",
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              className="flex-1 rounded-xl font-bold"
              style={{
                backgroundColor: "#10B981",
                color: "#FFFFFF",
              }}
            >
              Confirm & Start Surfing 🏄‍♂️
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
