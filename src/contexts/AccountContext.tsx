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
  connectReal: (accessToken: string, targetType?: AccountType) => Promise<void>
  disconnect: () => void
  updateBalance: (balance: number) => void
  addBalance: (amount: number) => void
  deductBalance: (amount: number) => void
  resetBalance: () => void
  refreshBalance: () => Promise<void>
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

  const connectReal = useCallback(async (accessToken: string, targetType: AccountType = "demo") => {
    // Prevent duplicate authentication attempts (race condition fix)
    if (isAuthenticatingRef.current) {
      console.log("[AccountContext] Authentication already in progress, skipping duplicate request")
      return
    }
    
    isAuthenticatingRef.current = true
    console.log(`[AccountContext] Connecting ${targetType} account with OAuth...`)
    
    // Store access token
    localStorage.setItem("deriv_access_token", accessToken)
    setAccountInfo((prev) => ({
      ...prev,
      accountType: targetType,
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
        
        // Step 2: Authenticate using OTP flow
        console.log(`[AccountContext] Attempt ${attempt}/${MAX_AUTH_RETRIES} - Authenticating with OTP flow...`)
        
        // Ensure token is strictly a string
        const tokenString = String(accessToken).trim()
        
        // 1. Fetch accounts to get an account_id
        const accountsResponse = await fetch("https://api.derivws.com/trading/v1/options/accounts", {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${tokenString}`,
            "Deriv-App-ID": import.meta.env.VITE_DERIV_APP_ID || "1089"
          }
        });
        
        if (!accountsResponse.ok) {
          throw new Error(`Failed to fetch accounts: ${accountsResponse.statusText}`);
        }
        
        const accountsData = await accountsResponse.json();
        if (!accountsData.data || accountsData.data.length === 0) {
          throw new Error("No accounts found for this user");
        }
        
        // Find the correct real trading account (prefer CR + USD account)
        // V2 API returns all accounts including crypto wallets (DOT, BTC, etc.)
        console.log("[AccountContext] Available accounts:", accountsData.data.map((a: any) => ({
          id: a.account_id, type: a.account_type, currency: a.currency, balance: a.balance
        })));
        
        let selectedAccount;
        if (targetType === "demo") {
          selectedAccount = accountsData.data.find((a: any) => a.account_type === "demo" || a.account_id?.startsWith('VRTC')) || accountsData.data[0];
        } else {
          selectedAccount = 
            // Priority 1: Non-demo account with USD currency
            accountsData.data.find((a: any) => a.account_type !== "demo" && a.currency === 'USD') ||
            // Priority 2: Non-demo account with USD-like currency (case insensitive)
            accountsData.data.find((a: any) => a.account_type !== "demo" && a.currency?.toUpperCase() === 'USD') ||
            // Priority 3: CR-prefixed account (legacy V1 format)
            accountsData.data.find((a: any) => a.account_id?.startsWith('CR')) ||
            // Priority 4: Any non-demo, non-virtual account
            accountsData.data.find((a: any) => a.account_type !== "demo" && a.account_type !== "virtual") ||
            // Priority 5: Any non-demo account
            accountsData.data.find((a: any) => a.account_type !== "demo") ||
            // Fallback: first account
            accountsData.data[0];
        }
        const accountId = selectedAccount.account_id;
        
        console.log(`[AccountContext] Selected account ID: ${accountId} (currency: ${selectedAccount.currency}), requesting OTP...`);
        
        // 2. Request OTP for the account
        const otpResponse = await fetch(`https://api.derivws.com/trading/v1/options/accounts/${accountId}/otp`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${tokenString}`,
            "Deriv-App-ID": import.meta.env.VITE_DERIV_APP_ID || "1089"
          }
        });
        
        if (!otpResponse.ok) {
          throw new Error(`Failed to get OTP: ${otpResponse.statusText}`);
        }
        
        const otpData = await otpResponse.json();
        const otpUrl = otpData.data.url;
        
        console.log(`[AccountContext] Received OTP URL, connecting WebSocket...`);
        
        // 3. Connect WebSocket using OTP URL
        await api.connectWithOTP(otpUrl);

        // 3.5 Store credentials for OTP refresh on reconnect
        api.storeCredentials(tokenString, accountId);

        // 4. Restore active subscriptions (ticks/ohlc) after connection
        api.restoreSubscriptions().catch(err => {
          console.warn("[AccountContext] Failed to restore subscriptions:", err)
        });
        
        // Trigger event so charts know connection changed
        window.dispatchEvent(new CustomEvent('account_connected', { detail: { accountType: targetType } }))
        
        let accountLoginId = accountId
        let accountBalance = Number(selectedAccount.balance) || 0
        let accountCurrency = selectedAccount.currency || "USD"
        
        // Update state with connected account info
        setAccountInfo((prev) => ({
          ...prev,
          accountType: targetType, // Ensure account type is set properly
          balance: accountBalance,
          currency: accountCurrency,
          loginId: accountLoginId,
          isConnected: true,
          isConnecting: false,
        }))
        
        console.log(`[AccountContext] ✅ State updated - ${targetType} account connected:`, {
          loginId: accountLoginId,
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
              balance: Number(balanceData.balance) || 0,
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

  // Set up event handlers for accounts
  useEffect(() => {
    const api = getDerivAPI()

    // Set up authorize response handler
    if (!authorizeHandlerRef.current) {
      authorizeHandlerRef.current = api.on("authorize", handleAuthorize)
    }

    // Auto-reconnect if we have a valid token but aren't connected
    const storedToken = localStorage.getItem("deriv_access_token")
    if (storedToken && storedToken !== "undefined" && storedToken !== "null" && !accountInfo.isConnected && !accountInfo.isConnecting) {
      console.log(`[AccountContext] Found valid stored token, auto-reconnecting to ${accountInfo.accountType}...`)
      connectReal(storedToken, accountInfo.accountType).catch(err => {
        console.error("[AccountContext] Auto-reconnect failed, falling back to demo mock:", err)
        disconnect()
      })
    } else if (accountInfo.isConnected) {
      // Trigger an event so other components know connection is restored
      window.dispatchEvent(new CustomEvent('account_connected', { detail: { accountType: accountInfo.accountType } }))
    }

    return () => {
      // Clean up handlers on unmount
      if (authorizeHandlerRef.current) {
        api.off("authorize", authorizeHandlerRef.current)
        authorizeHandlerRef.current = null
      }
    }
  }, [accountInfo.accountType, accountInfo.isConnected, accountInfo.isConnecting, connectReal, disconnect, handleAuthorize])

  const setAccountType = useCallback((type: AccountType) => {
    localStorage.setItem("account_type", type)
    setAccountInfo((prev) => {
      const token = prev.accessToken || localStorage.getItem("deriv_access_token");
      
      if (token && token !== "undefined" && token !== "null") {
        // We have a token, we should reconnect to the chosen account type via API
        // The useEffect will pick up the disconnected state and reconnect
        return {
          ...prev,
          accountType: type,
          isConnected: false,
          isConnecting: false,
        }
      }
      
      // No token fallback
      if (type === "demo") {
        return {
          accountType: "demo",
          balance: DEMO_BALANCE,
          currency: DEMO_CURRENCY,
          loginId: DEMO_LOGIN_ID,
          isConnected: false,
          isConnecting: false,
          accessToken: null,
        }
      } else {
        return {
          ...prev,
          accountType: "real",
          isConnecting: true, // Will trigger OAuth flow
        }
      }
    })
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

  const refreshBalance = useCallback(async () => {
    if (accountInfo.isConnected) {
      try {
        const api = getDerivAPI()
        const balanceData = await api.getBalance()
        if (balanceData?.balance !== undefined) {
          setAccountInfo(prev => ({
            ...prev,
            balance: Number(balanceData.balance),
            currency: balanceData.currency || prev.currency
          }))
        }
      } catch (err) {
        console.error('[AccountContext] Failed to manually refresh balance', err)
      }
    }
  }, [accountInfo.accountType, accountInfo.isConnected])

  const value: AccountContextType = {
    ...accountInfo,
    setAccountType,
    connectReal,
    disconnect,
    updateBalance,
    addBalance,
    deductBalance,
    resetBalance,
    refreshBalance,
  }

  return (
    <AccountContext.Provider value={value}>
      {children}
    </AccountContext.Provider>
  )
}
