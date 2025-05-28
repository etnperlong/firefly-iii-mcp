import "@auth/core/types"

declare module "@auth/core/types" {
  interface User {
    access_token?: string
    refresh_token?: string
  }

  interface Session {
    access_token?: string
    refresh_token?: string
  }
}