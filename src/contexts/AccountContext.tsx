import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react"
import { getDerivAPI } from "../lib/deriv-api"

export type AccountType = "demo" | "real"

interface AccountInfo {
  accountType: AccountType
  balance: number
  currency: string
  loginId: string | null
  isConnected: boolean
  isConnecting: boolean
  accessToken: string | null
}

interface AccountContextType extends AccountInfo {
  setAccountType: (type: AccountType) => void
  connectReal: (accessToken: string) => Promise<void>
  disconnect: () => void
  updateBalance: (balance: number) => void
  addBalance: (amount: number) => void
  deductBalance: (amount: number) => void
  resetBalance: () => void
}

const DEMO_BALANCE = 10000
const DEMO_CURRENCY = "USD"
const DEMO_LOGIN_ID = "Demo Account"

const AccountContext = createContext<AccountContextType | null>(null)

export function useAccount(): AccountContextType {
  const context = useContext(AccountContext)
  if (!context) {
    throw new Error("useAccount must be used within an AccountProvider")
  }
  return context
}

interface AccountProviderProps {
  children: React.ReactNode
}

export function AccountProvider({ children }: AccountProviderProps) {
  const [accountInfo, setAccountInfo] = useState<AccountInfo>(() => {
    // Check if user was previously connected to a real account
    const storedAccountType = localStorage.getItem("account_type") as AccountType | null
    const storedAccessToken = localStorage.getItem("deriv_access_token")
    return {
      accountType: storedAccountType || "demo",
      balance: storedAccountType === "real" ? 0 : DEMO_BALANCE,
      currency: storedAccountType === "real" ? "" : DEMO_CURRENCY,
      loginId: storedAccountType === "real" ? null : DEMO_LOGIN_ID,
      isConnected: false,
      isConnecting: false,
      accessToken: storedAccessToken || null,
    }
  })

  const balanceHandlerRef = useRef<((data: any) => void) | null>(null)
  const authorizeHandlerRef = useRef<((data: any) => void) | null>(null)
  const isAuthenticatingRef = useRef<boolean>(false)
  const authRetryCountRef = useRef<number>(0)
  const MAX_AUTH_RETRIES = 3

  const disconnect = useCallback(() => {
    // Switch back to demo
    localStorage.setItem("account_type", "demo")
    localStorage.removeItem("deriv_access_token")
    setAccountInfo({
      accountType: "demo",
      balance: DEMO_BALANCE,
      currency: DEMO_CURRENCY,
      loginId: DEMO_LOGIN_ID,
      isConnected: false,
      isConnecting: false,
      accessToken: null,
    })
  }, [])

  const handleBalanceUpdate = useCallback((data: any) => {
    if (data?.balance?.balance !== undefined) {
      setAccountInfo((prev) => ({
        ...prev,
        balance: data.balance.balance,
        currency: data.balance.currency || prev.currency,
      }))
    }
  }, [])

  const handleAuthorize = useCallback((data: any) => {
    if (data?.account_list && data.loginid) {
      setAccountInfo((prev) => ({
        ...prev,
        loginId: data.loginid,
        currency: data.currency || prev.currency,
        isConnecting: false,
        isConnected: true,
      }))
    }
  }, [])

  const connectReal = useCallback(async (accessToken: string) => {
    // Prevent duplicate authentication attempts (race condition fix)
    if (isAuthenticatingRef.current) {
      console.log("[AccountContext] Authentication already in progress, skipping duplicate request")
      return
    }
    
    isAuthenticatingRef.current = true
    console.log("[AccountContext] Connecting real account with OAuth...")
    
    // Store access token
    localStorage.setItem("deriv_access_token", accessToken)
    setAccountInfo((prev) => ({
      ...prev,
      accountType: "real",
      accessToken,
      isConnecting: true,
    }))

    if (!accessToken || accessToken === "undefined" || accessToken === "null") {
      console.error("[AccountContext] Cannot connect real account: No valid access token provided")
      localStorage.removeItem("deriv_access_token")
      isAuthenticatingRef.current = false
      setAccountInfo(prev => ({ ...prev, isConnecting: false, accountType: "demo", accessToken: null }))
      return
    }

    // Retry logic with exponential backoff
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= MAX_AUTH_RETRIES; attempt++) {
      try {
        const api = getDerivAPI()
        
        // Step 1: Connect WebSocket
        console.log(`[AccountContext] Attempt ${attempt}/${MAX_AUTH_RETRIES} - Connecting WebSocket...`)
        await api.initialize()
        
        // Wait for WebSocket to be fully ready before sending authorize
        console.log(`[AccountContext] Waiting for WebSocket to stabilize...`)
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Step 2: Authenticate with token (now has 30-second timeout)
        console.log(`[AccountContext] Attempt ${attempt}/${MAX_AUTH_RETRIES} - Authenticating with token...`)
        console.log(`[AccountContext] Token type being passed to API:`, typeof accessToken)
        
        // Ensure token is strictly a string before passing to authorize
        const tokenString = String(accessToken).trim()
        const authResponse = await api.authorize(tokenString)
        
        console.log("[AccountContext] Raw authorize response:", {
          "authResponse.balance": authResponse.balance,
          "typeof balance": typeof authResponse.balance,
          "authResponse.currency": authResponse.currency,
          "authResponse.loginid": authResponse.loginid,
          "authResponse.login_id": authResponse.login_id,
          "Full response keys": Object.keys(authResponse)
        })

        // Extract account details from response (Deriv API format)
        // The balance should be a number from the authorize response
        const accountBalance = typeof authResponse.balance === 'number' ? authResponse.balance : 0
        const accountCurrency = authResponse.currency || "USD"
        const accountId = authResponse.loginid || authResponse.login_id || null
        
        console.log("[AccountContext] ✅ Extracted values:", {
          balance: accountBalance,
          currency: accountCurrency,
          loginId: accountId
        })
        
        // Update state with connected account info
        setAccountInfo((prev) => ({
          ...prev,
          accountType: "real", // Ensure account type is set to real
          balance: accountBalance,
          currency: accountCurrency,
          loginId: accountId,
          isConnected: true,
          isConnecting: false,
        }))
        
        console.log("[AccountContext] ✅ State updated - Real account connected:", {
          loginId: accountId,
          balance: accountBalance,
          currency: accountCurrency
        })
        
        // Subscribe to balance updates to keep UI in sync with real-time changes
        try {
          console.log("[AccountContext] 📡 Subscribing to balance updates...")
          api.subscribeBalance((balanceData) => {
            console.log("[AccountContext] 💰 Balance update received:", balanceData)
            setAccountInfo((prev) => ({
              ...prev,
              balance: balanceData.balance,
              currency: balanceData.currency || prev.currency,
            }))
          })
          console.log("[AccountContext] ✅ Balance subscription active")
        } catch (balanceError) {
          console.warn("[AccountContext] ⚠️ Balance subscription failed (non-critical):", balanceError)
          // Don't fail the authentication if balance subscription fails
        }
        
        // Reset retry counter on success
        authRetryCountRef.current = 0
        isAuthenticatingRef.current = false
        return
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        console.error(`[AccountContext] Authentication attempt ${attempt}/${MAX_AUTH_RETRIES} failed:`, error)
        
        // If this was the last attempt, give up
        if (attempt === MAX_AUTH_RETRIES) {
          console.error("[AccountContext] All authentication attempts failed, falling back to demo")
          
          // Clear stored token to prevent infinite retry loops
          localStorage.removeItem("deriv_access_token")
          
          setAccountInfo((prev) => ({
            ...prev,
            isConnecting: false,
            isConnected: false,
          }))
          
          isAuthenticatingRef.current = false
          authRetryCountRef.current = 0
          
          // Fallback to demo mode after max retries
          setTimeout(() => {
            disconnect()
          }, 1000)
          
          throw new Error(`Authentication failed after ${MAX_AUTH_RETRIES} attempts: ${lastError.message}`)
        }
        
        // Exponential backoff: 2s, 4s, 8s
        const delay = 2000 * Math.pow(2, attempt - 1)
        console.log(`[AccountContext] Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    // This should never be reached, but just in case
    isAuthenticatingRef.current = false
    throw lastError || new Error("Authentication failed")
  }, [disconnect])

  // Set up event handlers for real account
  useEffect(() => {
    if (accountInfo.accountType === "real") {
      const api = getDerivAPI()

      // Set up balance subscription handler
      balanceHandlerRef.current = api.on("balance", handleBalanceUpdate)

      // Set up authorize response handler
      authorizeHandlerRef.current = api.on("authorize", handleAuthorize)

      // Auto-reconnect if we have a valid token but aren't connected
      const storedToken = localStorage.getItem("deriv_access_token")
      if (storedToken && storedToken !== "undefined" && storedToken !== "null" && !accountInfo.isConnected && !accountInfo.isConnecting) {
        console.log("[AccountContext] Found valid stored token, auto-reconnecting...")
        connectReal(storedToken).catch(err => {
          console.error("[AccountContext] Auto-reconnect failed, falling back to demo:", err)
          disconnect()
        })
      } else {
        // Skip balance fetch on public endpoint - it requires authentication
        // Balance will be fetched when user connects via OAuth
        console.log("[AccountContext] Real account selected - waiting for OAuth authentication")
      }

      return () => {
        // Clean up handlers
        if (balanceHandlerRef.current) {
          api.off("balance", balanceHandlerRef.current)
          balanceHandlerRef.current = null
        }
        if (authorizeHandlerRef.current) {
          api.off("authorize", authorizeHandlerRef.current)
          authorizeHandlerRef.current = null
        }
      }
    }
  }, [accountInfo.accountType, accountInfo.isConnected, accountInfo.isConnecting, connectReal, disconnect, handleBalanceUpdate, handleAuthorize])

  const setAccountType = useCallback((type: AccountType) => {
    if (type === "demo") {
      // Reset to demo account
      localStorage.setItem("account_type", "demo")
      setAccountInfo({
        accountType: "demo",
        balance: DEMO_BALANCE,
        currency: DEMO_CURRENCY,
        loginId: DEMO_LOGIN_ID,
        isConnected: false,
        isConnecting: false,
        accessToken: null,
      })
    } else {
      // Switch to real - will trigger OAuth flow
      setAccountInfo((prev) => ({
        ...prev,
        isConnecting: true,
      }))
    }
    localStorage.setItem("account_type", type)
  }, [])

  const updateBalance = useCallback((newBalance: number) => {
    setAccountInfo((prev) => ({
      ...prev,
      balance: Math.max(0, newBalance), // Prevent negative balance
    }))
  }, [])

  const addBalance = useCallback((amount: number) => {
    setAccountInfo((prev) => ({
      ...prev,
      balance: prev.balance + amount,
    }))
  }, [])

  const deductBalance = useCallback((amount: number) => {
    setAccountInfo((prev) => ({
      ...prev,
      balance: Math.max(0, prev.balance - amount),
    }))
  }, [])

  const resetBalance = useCallback(() => {
    setAccountInfo((prev) => ({
      ...prev,
      balance: DEMO_BALANCE,
    }))
  }, [])

  const value: AccountContextType = {
    ...accountInfo,
    setAccountType,
    connectReal,
    disconnect,
    updateBalance,
    addBalance,
    deductBalance,
    resetBalance,
  }

  return (
    <AccountContext.Provider value={value}>
      {children}
    </AccountContext.Provider>
  )
}
