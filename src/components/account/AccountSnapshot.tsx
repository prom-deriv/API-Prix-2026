import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { useTradingStore } from "../../stores/tradingStore"
import { useAccount } from "../../contexts/AccountContext"
import { formatCurrency, formatPercentage } from "../../lib/utils"
import { Wallet, TrendingUp, TrendingDown, Activity, ShieldCheck, User } from "lucide-react"
import { cn } from "../../lib/utils"

const AccountSnapshot: React.FC = () => {
  const { activeContracts, recentTrades } = useTradingStore()
  const { accountType, balance, currency } = useAccount()

  const totalProfit = recentTrades.reduce((sum, trade) => sum + (Number(trade.profit) || 0), 0)
  const winRate = recentTrades.length > 0
    ? (recentTrades.filter((t) => (Number(t.profit) || 0) > 0).length / recentTrades.length) * 100
    : 0

  const activePnL = activeContracts.reduce((sum, contract) => sum + (Number(contract.profit) || 0), 0)

  const isDemo = accountType === "demo"

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Account Snapshot
          </div>
          <span className={cn(
            "text-xs px-2 py-1 rounded-full font-medium",
            isDemo ? "bg-muted text-muted-foreground" : "bg-green-500/20 text-green-500"
          )}>
            {isDemo ? (
              <span className="flex items-center gap-1"><User className="h-3 w-3" /> Demo</span>
            ) : (
              <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Real</span>
            )}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Balance Display */}
        <div className="p-3 rounded-lg bg-muted/50">
          <p className="text-xs text-muted-foreground mb-1">
            {isDemo ? "Demo Balance" : "Real Balance"}
          </p>
          <p className="text-2xl font-bold">
            {formatCurrency(balance, currency || "USD")}
          </p>
        </div>

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
                      (Number(contract.profit) || 0) >= 0 ? "text-profit" : "text-loss"
                    }`}
                  >
                    {formatCurrency(Number(contract.profit) || 0)}
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
                      (Number(trade.profit) || 0) >= 0 ? "text-profit" : "text-loss"
                    }`}
                  >
                    {formatCurrency(Number(trade.profit) || 0)}
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
