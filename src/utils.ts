import type { OpenAPIV3 } from 'openapi-types';
import { env } from 'node:process'

/**
 * Acquires an OAuth2 token using client credentials flow
 * 
 * @param schemeName Name of the security scheme
 * @param scheme OAuth2 security scheme
 * @param cacheKv KV namespace for caching OAuth tokens
 * @returns Acquired token or null if unable to acquire
 */
export async function acquireOAuth2Token(schemeName: string, scheme: OpenAPIV3.OAuth2SecurityScheme, cacheKv: KVNamespace<string>): Promise<string | null | undefined> {
  try {
    // Check if we have the necessary credentials
    const clientId = env[`OAUTH_CLIENT_ID_SCHEMENAME`];
    const clientSecret = env[`OAUTH_CLIENT_SECRET_SCHEMENAME`];
    const scopes = env[`OAUTH_SCOPES_SCHEMENAME`];

    if (!clientId || !clientSecret) {
      console.error(`Missing client credentials for OAuth2 scheme '${schemeName}'`);
      return null;
    }

    // Check if we have a cached token
    const cacheKey = `${schemeName}_${clientId}`;
    const cachedToken = await cacheKv.get(cacheKey);

    if (cachedToken) {
      console.error(`Using cached OAuth2 token for '${schemeName}'`);
      return cachedToken;
    }

    // Determine token URL based on flow type
    let tokenUrl = '';
    if (scheme.flows?.clientCredentials?.tokenUrl) {
      tokenUrl = scheme.flows.clientCredentials.tokenUrl;
      console.error(`Using client credentials flow for '${schemeName}'`);
    } else if (scheme.flows?.password?.tokenUrl) {
      tokenUrl = scheme.flows.password.tokenUrl;
      console.error(`Using password flow for '${schemeName}'`);
    } else {
      console.error(`No supported OAuth2 flow found for '${schemeName}'`);
      return null;
    }

    // Prepare the token request
    let formData = new URLSearchParams();
    formData.append('grant_type', 'client_credentials');

    // Add scopes if specified
    if (scopes) {
      formData.append('scope', scopes);
    }

    console.error(`Requesting OAuth2 token from ${tokenUrl}`);

    // Make the token request

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
      },
      body: formData.toString()
    });
    const data: any = await response.json();

    // Process the response
    if (data?.access_token) {
      const token = data.access_token;
      const expiresIn = data.expires_in || 3600; // Default to 1 hour

      // Cache the token
      await cacheKv.put(cacheKey, token, {
        expiration: expiresIn
      });

      console.error(`Successfully acquired OAuth2 token for '${schemeName}' (expires in ${expiresIn} seconds)`);
      return token;
    } else {
      console.error(`Failed to acquire OAuth2 token for '${schemeName}': No access_token in response`);
      return null;
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error acquiring OAuth2 token for '${schemeName}':`, errorMessage);
    return null;
  }
}