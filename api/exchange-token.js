export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code, codeVerifier, clientId, redirectUri } = req.body;

    if (!code || !codeVerifier || !clientId || !redirectUri) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    console.log('[Vercel Function] Exchanging code for token...');
    console.log('[Vercel Function] Client ID:', clientId);
    console.log('[Vercel Function] Redirect URI:', redirectUri);

    const tokenUrl = process.env.VITE_DERIV_OAUTH_TOKEN_URL || 'https://auth.deriv.com/oauth2/token';

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error_description || `HTTP ${response.status}`);
    }

    const data = await response.json();

    console.log('[Vercel Function] Token exchange successful');

    return res.status(200).json(data);
  } catch (error) {
    console.error('[Vercel Function] Token exchange failed:', error.message);
    
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}
