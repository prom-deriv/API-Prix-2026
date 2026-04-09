import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { useTradingStore } from "../../stores/tradingStore"
import { formatCurrency, formatTimestamp, formatNumber } from "../../lib/utils"
import { cn } from "../../lib/utils"
import { History, TrendingUp, TrendingDown, ArrowRight } from "lucide-react"

const TradeHistory: React.FC = () => {
  const { recentTrades } = useTradingStore()

  if (recentTrades.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="h-4 w-4" />
            Trade History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground text-sm">
            No trades yet. Start trading to see your history.
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <History className="h-4 w-4" />
          Trade History
          <span className="text-xs font-normal text-muted-foreground">({recentTrades.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {recentTrades.map((trade, index) => {
            const isWin = trade.profit > 0
            const isLoss = trade.profit < 0
            
            return (
              <div 
                key={`${trade.contract_id}-${index}`}
                className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isWin ? (
                    <TrendingUp className="h-4 w-4 text-profit" />
                  ) : isLoss ? (
                    <TrendingDown className="h-4 w-4 text-loss" />
                  ) : (
                    <div className="h-4 w-4 rounded-full bg-muted-foreground/30" />
                  )}
                  <div>
                    <div className="text-sm font-medium">
                      {trade.contract_type}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatTimestamp(trade.date_start)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn(
                    "text-sm font-medium",
                    isWin && "text-profit",
                    isLoss && "text-loss"
                  )}>
                    {isWin ? "+" : ""}{formatCurrency(trade.profit)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Stake: {formatCurrency(trade.buy_price)}
                  </div>
                  {trade.entry_tick !== undefined && trade.exit_tick !== undefined && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <span>{trade.entry_tick_display_value || formatNumber(trade.entry_tick, 5)}</span>
                      <ArrowRight className="h-3 w-3" />
                      <span>{trade.exit_tick_display_value || formatNumber(trade.exit_tick, 5)}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export default TradeHistory