import { generateId } from "./utils"

const AUTH_ENDPOINT = "https://auth.deriv.com/oauth2/auth"
const TOKEN_ENDPOINT = "https://auth.deriv.com/oauth2/token"

interface OAuthConfig {
  clientId: string
  redirectUri: string
  scope?: string
}

interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
  scope?: string
}

interface PKCEChallenge {
  codeVerifier: string
  codeChallenge: string
  state: string
}

export function generatePKCEChallenge(): PKCEChallenge {
  const array = new Uint8Array(64)
  crypto.getRandomValues(array)
  const codeVerifier = Array.from(array)
    .map((v) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"[v % 66])
    .join("")

  const encoder = new TextEncoder()
  const data = encoder.encode(codeVerifier)
  return crypto.subtle.digest("SHA-256", data).then((hash) => {
    const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")

    const state = generateId()

    return { codeVerifier, codeChallenge, state }
  }) as unknown as PKCEChallenge
}

export function getAuthorizationUrl(config: OAuthConfig, pkce: PKCEChallenge): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: config.scope || "read trade payments",
    code_challenge: pkce.codeChallenge,
    code_challenge_method: "S256",
    state: pkce.state,
  })

  return `${AUTH_ENDPOINT}?${params.toString()}`
}

export async function exchangeCodeForToken(
  code: string,
  config: OAuthConfig,
  codeVerifier: string
): Promise<TokenResponse> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId,
      code,
      redirect_uri: config.redirectUri,
      code_verifier: codeVerifier,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error_description || "Failed to exchange code for token")
  }

  return response.json()
}

export async function refreshAccessToken(
  refreshToken: string,
  clientId: string
): Promise<TokenResponse> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      refresh_token: refreshToken,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error_description || "Failed to refresh token")
  }

  return response.json()
}

export function storeTokens(tokens: TokenResponse): void {
  const expiry = Date.now() + tokens.expires_in * 1000
  localStorage.setItem("deriv_access_token", tokens.access_token)
  localStorage.setItem("deriv_token_expiry", expiry.toString())
  if (tokens.refresh_token) {
    localStorage.setItem("deriv_refresh_token", tokens.refresh_token)
  }
}

export function getStoredToken(): { token: string | null; expiry: number | null } {
  const token = localStorage.getItem("deriv_access_token")
  const expiry = localStorage.getItem("deriv_token_expiry")
  return {
    token,
    expiry: expiry ? parseInt(expiry) : null,
  }
}

export function clearTokens(): void {
  localStorage.removeItem("deriv_access_token")
  localStorage.removeItem("deriv_token_expiry")
  localStorage.removeItem("deriv_refresh_token")
}

export function isTokenExpired(): boolean {
  const { expiry } = getStoredToken()
  if (!expiry) return true
  return Date.now() >= expiry - 60000
}

export async function getValidToken(clientId: string): Promise<string | null> {
  const { token } = getStoredToken()
  if (!token) return null

  if (!isTokenExpired()) {
    return token
  }

  const refreshToken = localStorage.getItem("deriv_refresh_token")
  if (!refreshToken) {
    clearTokens()
    return null
  }

  try {
    const newTokens = await refreshAccessToken(refreshToken, clientId)
    storeTokens(newTokens)
    return newTokens.access_token
  } catch {
    clearTokens()
    return null
  }
}
