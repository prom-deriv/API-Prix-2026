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

  // Check for OAuth callback on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get("code")
    const state = params.get("state")
    const storedState = sessionStorage.getItem("oauth_state")
    const storedVerifier = sessionStorage.getItem("oauth_code_verifier")

    if (code && state === storedState && storedVerifier) {
      handleOAuthCallback(code, storedVerifier)
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  const handleOAuthCallback = useCallback(async (code: string, codeVerifier: string) => {
    try {
      setError(null)
      const clientId = import.meta.env.VITE_DERIV_OAUTH_CLIENT_ID
      const redirectUri = window.location.origin

      console.log("[AccountSwitcher] Exchanging code for token via Serverless Function...")
      console.log("[AccountSwitcher] Client ID:", clientId)
      console.log("[AccountSwitcher] Redirect URI:", redirectUri)

      if (!clientId) {
        throw new Error("OAuth client ID not configured. Please check VITE_DERIV_OAUTH_CLIENT_ID environment variable.")
      }

      // Exchange code for token using Serverless Function (bypasses CORS)
      const isVercel = window.location.hostname.includes('vercel.app')
      const endpoint = isVercel ? '/api/exchange-token' : '/.netlify/functions/exchange-token'
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          codeVerifier,
          clientId,
          redirectUri,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error_description || errorData.error || `HTTP ${response.status}`)
      }

      const tokenResponse = await response.json()
      console.log("[AccountSwitcher] Token exchange successful")
      
      // Connect with the access token
      await connectReal(tokenResponse.access_token)
    } catch (error) {
      console.error("[AccountSwitcher] OAuth callback failed:", error)
      setError(error instanceof Error ? error.message : "OAuth authentication failed")
    }
  }, [connectReal])

  const handleConnectReal = useCallback(async () => {
    try {
      setError(null)
      
      // Start OAuth flow
      const api = getDerivAPI()
      const clientId = import.meta.env.VITE_DERIV_OAUTH_CLIENT_ID
      const redirectUri = window.location.origin

      console.log("[AccountSwitcher] Starting OAuth flow...")
      console.log("[AccountSwitcher] Client ID:", clientId)
      console.log("[AccountSwitcher] Redirect URI:", redirectUri)

      if (!clientId) {
        throw new Error("OAuth client ID not configured. Please check VITE_DERIV_OAUTH_CLIENT_ID environment variable.")
      }

      // generateOAuthUrl is now async and includes code_challenge in the URL
      // Use prompt="login" to force the login page to appear even if user has active session
      const { url, codeVerifier, state } = await api.generateOAuthUrl(clientId, redirectUri, "trade", "login")

      console.log("[AccountSwitcher] OAuth URL generated, redirecting...")

      // Store state and verifier for callback verification
      sessionStorage.setItem("oauth_state", state)
      sessionStorage.setItem("oauth_code_verifier", codeVerifier)

      // Redirect to Deriv OAuth (code_challenge is already in the URL)
      window.location.href = url
    } catch (error) {
      console.error("[AccountSwitcher] Failed to start OAuth flow:", error)
      setError(error instanceof Error ? error.message : "Failed to start authentication")
    }
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
                {loginId}
              </p>
            ) : (
              <p className="flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3 text-green-500" />
                {loginId || "Not connected"}
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
