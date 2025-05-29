import { Context } from "hono";
import { initAuthConfig, authHandler, verifyAuth } from '@hono/auth-js';
import { App } from "./types";

export const setupOAuth = (app: App) => {
  app.use("*", initAuthConfig((c: Context) => ({
    secret: c.env.AUTH_SECRET,
    providers: [
      {
        type: 'oauth',
        id: 'firefly-iii',
        name: 'Firefly III',
        issuer: c.env.FIREFLY_III_BASE_URL,
        clientId: c.env.FIREFLY_III_OAUTH_CLIENT_ID,
        clientSecret: c.env.FIREFLY_III_OAUTH_CLIENT_SECRET,
        authorization: {
          url: `${c.env.FIREFLY_III_BASE_URL}/oauth/authorize`,
          params: {
            scope: ''
          }
        },
        token: `${c.env.FIREFLY_III_BASE_URL}/oauth/token`,
        userinfo: `${c.env.FIREFLY_III_BASE_URL}/api/v1/about/user`,
        profile(profile) {
          const userData = profile.data?.attributes || {};
          const userId = profile.data?.id || "1";
          return {
            id: userId,
            name: userData.name || userData.email || userId,
            email: userData.email || userId,
            role: userData.role,
            // Additional user properties can be added here
            created_at: userData.created_at,
            updated_at: userData.updated_at,
            blocked: userData.blocked,
            blocked_code: userData.blocked_code
          }
        },
      }
    ],
    callbacks: {
      async session({ session, token }) {
        session.user.id = token.id as string;
        session.user.access_token = token.accessToken as string;
        return session;
      },
      async jwt({ token, user, account, profile }) {
        if (user) {
          token.id = user.id;
        }
        if (account) {
          token.accessToken = account.access_token;
          token.refreshToken = account.refresh_token;
        }
        return token;
      },
      redirect({ url, baseUrl }) {
        return `${baseUrl}/api/success`
      }
    }
  })));

  app.use('/api/auth/*', authHandler());
  app.use('/api/*', verifyAuth());
};

export const getToken = (c: Context<{
  Bindings: Env;
}, "/userInfo", {}>) => {
  const tokenInQuery = c.req.query('token');
  const tokenInHeader = c.req.header('Authorization')?.split(' ')[1];
  const tokenInSecret = c.env.FIREFLY_III_PAT;
  const token = tokenInQuery || tokenInHeader || tokenInSecret;
  return token;
}

export { verifyAuth };