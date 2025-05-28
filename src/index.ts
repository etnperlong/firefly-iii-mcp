import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors';
import { authHandler, initAuthConfig, verifyAuth } from '@hono/auth-js'
import { v4 as uuid } from 'uuid';

import { FireflyIIIAgent } from './agent';
import { UserProps } from './types';
import { UserinfoEndpointHandler } from '@auth/core/providers/oauth';

const app = new Hono<{ Bindings: Env }>()

app.use(logger())
app.use('*', cors());
app.use("*", initAuthConfig((c) => ({
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
          // 可以添加其他需要的用户属性
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
    
  }
})))

app.use('/api/auth/*', authHandler())
app.use('/api/*', verifyAuth())

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.get('/userInfo', verifyAuth(), (c) => {
  const auth = c.get('authUser');
  return c.json(auth.session.user);
})

app.use("/mcp", (c) => {
  // const auth = c.get('authUser');
  // Streamable MCP server
  const executionCtx = {
    ...c.executionCtx,
    props: {} satisfies UserProps
  }
  const mcp = FireflyIIIAgent.serve('/mcp').fetch(c.req.raw, c.env, executionCtx);
  return mcp;
});

export default app
export { FireflyIIIAgent } from './agent';
