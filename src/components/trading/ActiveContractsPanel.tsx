import { useState } from "react"
import { useTradingStore } from "../../stores/tradingStore"
import { Card } from "../ui/card"
import { Button } from "../ui/button"
import { getDerivAPI } from "../../lib/deriv-api"
import { TrendingUp, TrendingDown, Settings, X, DollarSign } from "lucide-react"
import StopLossTakeProfitModal from "./StopLossTakeProfitModal"

export default function ActiveContractsPanel() {
  const activeContracts = useTradingStore((state) => state.activeContracts)
  const removeActiveContract = useTradingStore((state) => state.removeActiveContract)
  const getContractSLTP = useTradingStore((state) => state.getContractSLTP)
  const addRecentTrade = useTradingStore((state) => state.addRecentTrade)
  
  const [selectedContractId, setSelectedContractId] = useState<number | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [sellLoading, setSellLoading] = useState<number | null>(null)

  const handleSellContract = async (contractId: number, sellPrice: number) => {
    setSellLoading(contractId)
    try {
      const api = getDerivAPI()
      const result = await api.sellContract(contractId, sellPrice)
      
      console.log("[ActiveContracts] Contract sold:", result)
      
      // Add to recent trades
      const contract = activeContracts.find(c => c.contract_id === contractId)
      if (contract) {
        addRecentTrade({
          app_id: 0,
          buy_price: contract.buy_price,
          contract_id: contractId,
          contract_type: contract.contract_type,
          currency: contract.currency,
          date_expiry: contract.date_expiry,
          date_start: contract.date_start,
          longcode: contract.longcode,
          payout: contract.payout,
          profit: contract.profit,
          sell_price: result.sold_for,
          sell_time: Date.now() / 1000,
          shortcode: contract.shortcode,
          transaction_id: result.transaction_id,
        })
      }
      
      // Remove from active contracts
      removeActiveContract(contractId)
    } catch (error) {
      console.error("[ActiveContracts] Failed to sell contract:", error)
      alert("Failed to sell contract. Please try again.")
    } finally {
      setSellLoading(null)
    }
  }

  const handleOpenSLTPModal = (contractId: number) => {
    setSelectedContractId(contractId)
    setIsModalOpen(true)
  }

  const handleCloseSLTPModal = () => {
    setSelectedContractId(null)
    setIsModalOpen(false)
  }

  if (activeContracts.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-500">
          <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No active contracts</p>
          <p className="text-xs mt-1">Your open trades will appear here</p>
        </div>
      </Card>
    )
  }

  return (
    <>
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            Active Contracts ({activeContracts.length})
          </h3>
        </div>

        <div className="space-y-3">
          {activeContracts.map((contract) => {
            const sltp = getContractSLTP(contract.contract_id)
            const isProfitable = contract.profit > 0
            const profitPercentage = ((contract.profit / contract.buy_price) * 100).toFixed(2)
            const isExpired = contract.is_expired === 1
            const isSold = contract.is_sold === 1

            return (
              <div
                key={contract.contract_id}
                className="border rounded-lg p-4 space-y-3 bg-gray-50 dark:bg-gray-800/50"
              >
                {/* Contract Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{contract.display_name}</h4>
                      <span
                        className={`px-2 py-0.5 text-xs rounded ${
                          contract.contract_type.includes("CALL") || contract.contract_type.includes("RISE")
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                        }`}
                      >
                        {contract.contract_type}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {contract.shortcode}
                    </p>
                  </div>

                  {/* Status Badge */}
                  {(isExpired || isSold) && (
                    <span className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded">
                      {contract.status.toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Price Info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Entry Price</p>
                    <p className="font-semibold">{contract.entry_spot_display_value}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Current Price</p>
                    <p className="font-semibold">{contract.current_spot_display_value}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Buy Price</p>
                    <p className="font-semibold">${contract.buy_price.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Payout</p>
                    <p className="font-semibold">${contract.payout.toFixed(2)}</p>
                  </div>
                </div>

                {/* P&L Display */}
                <div
                  className={`flex items-center justify-between p-3 rounded ${
                    isProfitable
                      ? "bg-green-100 dark:bg-green-900/30"
                      : "bg-red-100 dark:bg-red-900/30"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isProfitable ? (
                      <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
                    )}
                    <span className="font-semibold">
                      {isProfitable ? "+" : ""}${contract.profit.toFixed(2)}
                    </span>
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      isProfitable
                        ? "text-green-700 dark:text-green-300"
                        : "text-red-700 dark:text-red-300"
                    }`}
                  >
                    {isProfitable ? "+" : ""}{profitPercentage}% ROI
                  </span>
                </div>

                {/* SL/TP Visual Indicator */}
                {(sltp?.stopLoss || sltp?.takeProfit) && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                      <span>SL: ${sltp.stopLoss?.toFixed(2) || "N/A"}</span>
                      <span>Current: ${contract.bid_price.toFixed(2)}</span>
                      <span>TP: ${sltp.takeProfit?.toFixed(2) || "N/A"}</span>
                    </div>
                    {/* Progress Bar */}
                    <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`absolute h-full ${
                          isProfitable ? "bg-green-500" : "bg-red-500"
                        }`}
                        style={{
                          width: sltp.stopLoss && sltp.takeProfit
                            ? `${Math.min(
                                100,
                                Math.max(
                                  0,
                                  ((contract.bid_price - sltp.stopLoss) /
                                    (sltp.takeProfit - sltp.stopLoss)) *
                                    100
                                )
                              )}%`
                            : "50%",
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleOpenSLTPModal(contract.contract_id)}
                    disabled={isExpired || isSold}
                  >
                    <Settings className="w-4 h-4 mr-1" />
                    {sltp?.stopLoss || sltp?.takeProfit ? "Edit" : "Set"} SL/TP
                  </Button>

                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1"
                    onClick={() => handleSellContract(contract.contract_id, contract.bid_price)}
                    disabled={isExpired || isSold || sellLoading === contract.contract_id}
                  >
                    {sellLoading === contract.contract_id ? (
                      "Selling..."
                    ) : (
                      <>
                        <X className="w-4 h-4 mr-1" />
                        Sell Now
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* SL/TP Modal */}
      {selectedContractId && (
        <StopLossTakeProfitModal
          isOpen={isModalOpen}
          onClose={handleCloseSLTPModal}
          contractId={selectedContractId}
          contract={activeContracts.find((c) => c.contract_id === selectedContractId)!}
        />
      )}
    </>
  )
}
