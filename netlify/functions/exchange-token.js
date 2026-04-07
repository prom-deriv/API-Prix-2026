exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { code, codeVerifier, clientId, redirectUri } = JSON.parse(event.body);

    if (!code || !codeVerifier || !clientId || !redirectUri) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required parameters' }),
      };
    }

    console.log('[Netlify Function] Exchanging code for token...');
    console.log('[Netlify Function] Client ID:', clientId);
    console.log('[Netlify Function] Redirect URI:', redirectUri);

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

    console.log('[Netlify Function] Token exchange successful');

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error('[Netlify Function] Token exchange failed:', error.message);
    
    if (error.response) {
      console.error('[Netlify Function] Error response:', error.response.data);
      return {
        statusCode: error.response.status,
        body: JSON.stringify({
          error: error.response.data.error || 'Token exchange failed',
          error_description: error.response.data.error_description || error.message,
        }),
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }),
    };
  }
};