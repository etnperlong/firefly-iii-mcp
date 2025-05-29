/**
 * Hono App Type
 */
export type App = typeof import('./index').default;

/**
 * MCP Agent Properties
 */
export type AgentProps = {
	token?: string
};

