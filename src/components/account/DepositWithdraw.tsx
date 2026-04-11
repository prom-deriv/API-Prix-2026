import React, { useState } from "react"
import { Button } from "../ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { useAccount } from "../../contexts/AccountContext"
import { getDerivAPI } from "../../lib/deriv-api"
import { ArrowDownToLine, ArrowUpFromLine, Loader2, ExternalLink, AlertCircle, CheckCircle2 } from "lucide-react"
import { cn } from "../../lib/utils"

interface DepositWithdrawProps {
  className?: string
}

const DepositWithdraw: React.FC<DepositWithdrawProps> = ({ className }) => {
  const { accountType, balance, currency, loginId, addBalance } = useAccount()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const isReal = accountType === "real"

  const handleDeposit = async () => {
    if (!isReal) {
      addBalance(1000)
      setSuccess("Added 1000 to demo balance")
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const api = getDerivAPI()
      const url = await api.deposit(currency || "USD")
      window.open(url, "_blank", "noopener,noreferrer")
      setSuccess("Deposit page opened in a new tab")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to open deposit page"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleWithdraw = async () => {
    if (!isReal) {
      setError("Withdrawal is only available for real accounts")
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const api = getDerivAPI()
      const url = await api.withdraw(currency || "USD")
      window.open(url, "_blank", "noopener,noreferrer")
      setSuccess("Withdrawal page opened in a new tab")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to open withdrawal page"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Deposit & Withdraw</CardTitle>
        <div className="text-sm text-muted-foreground">
          Account: {loginId} · Balance: {currency} {balance.toFixed(2)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-green-500/10 text-green-500">
            <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span className="text-sm">{success}</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="profit"
            size="lg"
            onClick={handleDeposit}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowDownToLine className="h-4 w-4" />
            )}
            <div className="flex flex-col items-start">
              <span className="text-sm font-bold">Deposit</span>
              <span className="text-[10px] opacity-80">Add funds</span>
            </div>
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={handleWithdraw}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUpFromLine className="h-4 w-4" />
            )}
            <div className="flex flex-col items-start">
              <span className="text-sm font-bold">Withdraw</span>
              <span className="text-[10px] opacity-80">Cash out</span>
            </div>
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center">
          Opens Deriv's secure cashier in a new tab
          <ExternalLink className="h-2.5 w-2.5 inline ml-1" />
        </p>
      </CardContent>
    </Card>
  )
}

export default DepositWithdraw