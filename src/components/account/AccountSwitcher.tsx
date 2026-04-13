import React, { useEffect, useCallback, useState } from "react"
import { Button } from "../ui/button"
import { Card, CardContent } from "../ui/card"
import { useAccount } from "../../contexts/AccountContext"
import { Wallet, LogOut, User, ShieldCheck, Loader2, RotateCcw } from "lucide-react"
import { formatCurrency } from "../../lib/utils"
import { cn } from "../../lib/utils"
import { getDerivAPI } from "../../lib/deriv-api"

interface AccountSwitcherProps {
  className?: string
}

const AccountSwitcher: React.FC<AccountSwitcherProps> = ({ className }) => {
  const { accountType, balance, currency, loginId, isConnecting, setAccountType, connectReal, disconnect, resetBalance } = useAccount()
  const [error, setError] = useState<string | null>(null)

  const isDemo = accountType === "demo"

  // Check for Classic OAuth implicit callback on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token1 = params.get("token1")
    
    if (token1) {
      console.log("[AccountSwitcher] Received classic OAuth token in URL")
      handleClassicOAuthCallback(token1)
      // Clean up URL to remove sensitive tokens
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  const handleClassicOAuthCallback = useCallback(async (token: string) => {
    try {
      setError(null)
      console.log("[AccountSwitcher] Connecting with classic OAuth token...")
      await connectReal(token)
    } catch (error) {
      console.error("[AccountSwitcher] OAuth callback failed:", error)
      const errorMessage = error instanceof Error ? error.message : "OAuth authentication failed"
      
      // Provide user-friendly error messages
      if (errorMessage.includes("timeout")) {
        setError("Connection timeout. Please check your internet and try again.")
      } else if (errorMessage.includes("Authentication failed after")) {
        setError("Unable to connect to your Deriv account. Please try again or contact support.")
      } else {
        setError(errorMessage)
      }
    }
  }, [connectReal])

  const handleConnectReal = useCallback(() => {
    setError(null)
    const appId = import.meta.env.VITE_DERIV_APP_ID

    console.log("[AccountSwitcher] Starting Classic OAuth flow...")
    console.log("[AccountSwitcher] App ID:", appId)

    if (!appId) {
      setError("OAuth App ID not configured. Please check VITE_DERIV_APP_ID environment variable.")
      return
    }

    // Use Classic OAuth Implicit Flow
    const oauthUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${appId}&l=en&brand=deriv`
    
    console.log("[AccountSwitcher] Redirecting to:", oauthUrl)
    window.location.href = oauthUrl
  }, [])

  return (
    <Card className={cn("w-full", className)}>
      <CardContent className="p-4">
        {/* Account Type Toggle */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg mb-4">
          <Button
            variant={isDemo ? "default" : "ghost"}
            size="sm"
            onClick={() => setAccountType("demo")}
            className="flex-1 text-xs gap-1.5"
          >
            <User className="h-3.5 w-3.5" />
            Demo
          </Button>
          <Button
            variant={!isDemo ? "default" : "ghost"}
            size="sm"
            onClick={() => setAccountType("real")}
            className="flex-1 text-xs gap-1.5"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Real
          </Button>
        </div>

        {/* Account Info */}
        <div className="space-y-3">
          {/* Balance Display */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className={cn(
                "h-5 w-5",
                isDemo ? "text-muted-foreground" : "text-yellow-500"
              )} />
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">
                    {isDemo ? "Demo Balance" : "Real Balance"}
                  </p>
                  {isDemo && (
                    <div className="relative flex items-center group">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 rounded-full transition-colors hover:bg-muted"
                        onClick={resetBalance}
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                      <span className="absolute left-6 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-popover text-popover-foreground text-[10px] px-2 py-1 rounded shadow-md pointer-events-none z-10 border border-border">
                        Reset Balance
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-lg font-bold">
                  {formatCurrency(balance, currency || "USD")}
                </p>
              </div>
            </div>
          </div>

          {/* Account Details */}
          <div className="text-xs text-muted-foreground">
            {isDemo ? (
              <p className="flex items-center gap-1.5">
                <User className="h-3 w-3" />
                Demo Account
              </p>
            ) : (
              <p className="flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3 text-green-500" />
                {loginId ? `Real Account: ${loginId}` : "Not connected"}
              </p>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-xs text-red-500 bg-red-500/10 p-2 rounded">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {isDemo ? (
              <Button
                variant="default"
                size="sm"
                onClick={handleConnectReal}
                disabled={isConnecting}
                className="w-full text-xs gap-1.5"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Connect to Deriv
                  </>
                )}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={disconnect}
                className="w-full text-xs gap-1.5"
              >
                <LogOut className="h-3.5 w-3.5" />
                Switch to Demo
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default AccountSwitcher
