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

  // Set up event handlers for real account
  useEffect(() => {
    if (accountInfo.accountType === "real") {
      const api = getDerivAPI()

      // Set up balance subscription handler
      balanceHandlerRef.current = api.on("balance", handleBalanceUpdate)

      // Set up authorize response handler
      authorizeHandlerRef.current = api.on("authorize", handleAuthorize)

      // Skip balance fetch on public endpoint - it requires authentication
      // Balance will be fetched when user connects via OAuth
      console.log("[AccountContext] Real account selected - waiting for OAuth authentication")

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
  }, [accountInfo.accountType, handleBalanceUpdate, handleAuthorize])

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

  const connectReal = useCallback(async (accessToken: string) => {
    console.log("[AccountContext] Connecting real account with OAuth...")
    
    // Store access token
    localStorage.setItem("deriv_access_token", accessToken)
    setAccountInfo((prev) => ({
      ...prev,
      accountType: "real",
      accessToken,
      isConnecting: true,
    }))

    try {
      const api = getDerivAPI()
      
      // Step 1: Get accounts list to find the account ID
      console.log("[AccountContext] Fetching accounts...")
      const accountsResponse = await api.getAccounts(accessToken)
      console.log("[AccountContext] Accounts response:", accountsResponse)
      
      // Find the first account (or the one we want to use)
      const account = accountsResponse.data?.[0]
      if (!account) {
        throw new Error("No trading accounts found")
      }
      
      const accountId = account.account_id
      console.log("[AccountContext] Using account:", accountId)
      
      // Step 2: Get OTP for WebSocket authentication
      console.log("[AccountContext] Getting OTP for WebSocket...")
      const otpResponse = await api.getWebSocketUrl(accessToken, accountId)
      console.log("[AccountContext] OTP response received")
      
      // Step 3: Connect with OTP-authenticated URL
      console.log("[AccountContext] Connecting with OTP URL...")
      await api.connectWithOTP(otpResponse.data.url)
      console.log("[AccountContext] Connected with OTP!")
      
      // Step 4: Extract balance from accounts response (REST API)
      // The accounts response should contain balance information
      console.log("[AccountContext] Extracting balance from accounts response...")
      const accountBalance = account.balance || 0
      const accountCurrency = account.currency || "USD"
      console.log("[AccountContext] Balance from accounts:", accountBalance, accountCurrency)
      
      // Update state with connected account info
      setAccountInfo((prev) => ({
        ...prev,
        balance: accountBalance,
        currency: accountCurrency,
        loginId: accountId,
        isConnected: true,
        isConnecting: false,
      }))
      
    } catch (error) {
      console.error("[AccountContext] Failed to connect real account:", error)
      setAccountInfo((prev) => ({
        ...prev,
        isConnecting: false,
        isConnected: false,
      }))
      throw error
    }
  }, [])

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

  const updateBalance = useCallback((newBalance: number) => {
    setAccountInfo((prev) => ({
      ...prev,
      balance: Math.max(0, newBalance), // Prevent negative balance
    }))
  }, [])

  const value: AccountContextType = {
    ...accountInfo,
    setAccountType,
    connectReal,
    disconnect,
    updateBalance,
  }

  return (
    <AccountContext.Provider value={value}>
      {children}
    </AccountContext.Provider>
  )
}