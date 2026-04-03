import React from "react"
import { useTradingStore } from "../../stores/tradingStore"
import { cn } from "../../lib/utils"
import { Button } from "../ui/button"
import { 
  AreaChart, 
  LineChart, 
  CandlestickChart,
} from "lucide-react"
import type { ChartStyle } from "../../types/deriv"

interface ChartStyleSelectorProps {
  className?: string
}

const chartStyles: Array<{
  value: ChartStyle
  label: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { value: 'area', label: 'Area', icon: AreaChart },
  { value: 'line', label: 'Line', icon: LineChart },
  { value: 'candlestick', label: 'Candle', icon: CandlestickChart },
]

const ChartStyleSelector: React.FC<ChartStyleSelectorProps> = ({ className }) => {
  const { chartStyle, setChartStyle } = useTradingStore()

  return (
    <div className={cn("flex items-center gap-1 bg-background/80 backdrop-blur-sm rounded-lg p-1 border border-border", className)}>
      {chartStyles.map(({ value, label, icon: Icon }) => (
        <Button
          key={value}
          variant={chartStyle === value ? "default" : "ghost"}
          size="sm"
          onClick={() => setChartStyle(value)}
          className={cn(
            "h-8 px-2 gap-1.5",
            chartStyle === value 
              ? "bg-primary text-primary-foreground" 
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
          title={label}
        >
          <Icon className="h-4 w-4" />
          <span className="text-xs font-medium hidden sm:inline">{label}</span>
        </Button>
      ))}
    </div>
  )
}

export default ChartStyleSelector