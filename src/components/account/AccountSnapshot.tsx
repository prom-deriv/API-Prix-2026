import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { useTradingStore } from "../../stores/tradingStore"
import { formatCurrency, formatPercentage } from "../../lib/utils"
import { Wallet, TrendingUp, TrendingDown, Activity } from "lucide-react"

const AccountSnapshot: React.FC = () => {
  const { activeContracts, recentTrades } = useTradingStore()

  const totalProfit = recentTrades.reduce((sum, trade) => sum + trade.profit, 0)
  const winRate = recentTrades.length > 0
    ? (recentTrades.filter((t) => t.profit > 0).length / recentTrades.length) * 100
    : 0

  const activePnL = activeContracts.reduce((sum, contract) => sum + contract.profit, 0)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Account Snapshot
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Active P&L</p>
            <p className={`text-xl font-bold ${activePnL >= 0 ? "text-profit" : "text-loss"}`}>
              {formatCurrency(activePnL)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total P&L</p>
            <p className={`text-xl font-bold ${totalProfit >= 0 ? "text-profit" : "text-loss"}`}>
              {formatCurrency(totalProfit)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Win Rate</p>
            <p className="text-xl font-bold">{formatPercentage(winRate)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total Trades</p>
            <p className="text-xl font-bold">{recentTrades.length}</p>
          </div>
        </div>

        <div className="pt-2 border-t border-border">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Active Contracts</span>
            </div>
            <span className="font-medium">{activeContracts.length}</span>
          </div>
        </div>

        {activeContracts.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Active Positions</p>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {activeContracts.slice(0, 3).map((contract) => (
                <div
                  key={contract.contract_id}
                  className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    {contract.contract_type === "CALL" ? (
                      <TrendingUp className="h-4 w-4 text-profit" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-loss" />
                    )}
                    <span className="text-sm font-medium">
                      {contract.display_name}
                    </span>
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      contract.profit >= 0 ? "text-profit" : "text-loss"
                    }`}
                  >
                    {formatCurrency(contract.profit)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {recentTrades.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Recent Trades</p>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {recentTrades.slice(0, 3).map((trade) => (
                <div
                  key={trade.transaction_id}
                  className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    {trade.contract_type === "CALL" ? (
                      <TrendingUp className="h-4 w-4 text-profit" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-loss" />
                    )}
                    <span className="text-sm">
                      {trade.contract_type}
                    </span>
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      trade.profit >= 0 ? "text-profit" : "text-loss"
                    }`}
                  >
                    {formatCurrency(trade.profit)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default AccountSnapshot
