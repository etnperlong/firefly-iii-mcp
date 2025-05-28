import { AuthUser } from "@hono/auth-js";

export type App = typeof import('./index').default;

export type UserProps = {
	token?: string
};