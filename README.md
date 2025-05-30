# Firefly III MCP Server

This project is an MCP (Model Context Protocol) server for Firefly III, a free and open-source personal finance manager. It allows users to leverage AI tools to manage their Firefly III accounts and transactions by providing a set of tools accessible via this MCP server. This enables the creation of AI assistants for personal accounting and financial management.

## Features

*   Interact with your Firefly III instance using AI.
*   Manage accounts and transactions programmatically.
*   Extensible toolset for various financial operations.

## Prerequisites

*   A running instance of [Firefly III](https://www.firefly-iii.org/).
*   A Cloudflare account if you plan to deploy using the "Deploy to Cloudflare" button.

## Getting Started

### 1. Obtain a Firefly III Personal Access Token (PAT)

To allow the MCP server to interact with your Firefly III instance, you need to generate a Personal Access Token (PAT).

1.  Log in to your Firefly III instance.
2.  Navigate to **Options > Profile > OAuth**.
3.  Under the "Personal access tokens" section, click on "Create new token".
4.  Give your token a descriptive name (e.g., "MCP Server Token").
5.  Click "Create".
6.  **Important:** Copy the generated token immediately. You will not be able to see it again.

For more details, refer to the official Firefly III documentation on [Personal Access Tokens](https://docs.firefly-iii.org/how-to/firefly-iii/features/api/).

### 2. Configure the MCP Server

You need to provide the Firefly III PAT and your Firefly III instance URL to the MCP server. This can be done in several ways, listed in order of recommendation for security and compatibility:

*   **In Request Headers (Recommended):**

    Provide these values in the headers of each request to the MCP server. This is generally the most secure method. The specific header names will depend on the MCP client implementation but common practice is:
    *   `X-Firefly-III-Url`: Your Firefly III instance URL (e.g., `https://firefly.yourdomain.com`)
    *   `Authorization`: The Personal Access Token, typically prefixed with `Bearer ` (e.g., `Bearer YOUR_FIREFLY_III_PAT`).

    Please consult the documentation of the AI tool or client you are using for the exact header names it expects.

*   **Query Parameters (Use with caution):**

    Alternatively, you can provide these values in the query parameters of each request to the MCP server. Be mindful that URLs, including query parameters, can be logged in various places, potentially exposing sensitive information.
    The specific query parameter names will depend on the MCP client implementation but generally would be:
    *   `baseUrl`: Your Firefly III instance URL
    *   `pat`: Your Firefly III Personal Access Token

*   **Environment Variables (Primarily for self-hosting/local development):**

    Set the following environment variables before running the server. This method is suitable when you have full control over the server environment.

    ```bash
    FIREFLY_III_BASE_URL="YOUR_FIREFLY_III_INSTANCE_URL" # e.g., https://firefly.yourdomain.com
    FIREFLY_III_PAT="YOUR_FIREFLY_III_PAT"
    ```

    If you are running the project locally using `npm run dev`, you can create a `.dev.vars` file in the project root and add these variables:

    ```
    FIREFLY_III_BASE_URL="YOUR_FIREFLY_III_INSTANCE_URL"
    FIREFLY_III_PAT="YOUR_FIREFLY_III_PAT"
    ```

## Running the MCP Server

### Using NPM Package (Easiest)

You can run the MCP server locally using the npm package:

```bash
# Install globally
npm install -g @firefly-iii-mcp/local

# Run with your Firefly III URL and PAT
firefly-iii-mcp --pat YOUR_PAT --baseUrl YOUR_FIREFLY_III_URL
```

Or use it directly with npx:

```bash
npx @firefly-iii-mcp/local --pat YOUR_PAT --baseUrl YOUR_FIREFLY_III_URL
```

You can also create a `.env` file with your PAT and BASE_URL:

```
PAT=YOUR_PAT
BASE_URL=YOUR_FIREFLY_III_URL
```

And then run:

```bash
npx @firefly-iii-mcp/local
```

### Deploy to Cloudflare Workers (Recommended for Production)

You can easily deploy this MCP server to Cloudflare Workers using the button below:

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/etnperlong/firefly-iii-mcp)

**Note:** After deploying, you will need to configure the `FIREFLY_III_BASE_URL` and `FIREFLY_III_PAT` environment variables in your Cloudflare Worker's settings.

1.  Go to your Cloudflare dashboard.
2.  Navigate to Workers & Pages.
3.  Select your deployed Worker.
4.  Go to Settings > Variables.
5.  Add the `FIREFLY_III_BASE_URL` and `FIREFLY_III_PAT` as secret variables.

### Run the MCP Server Locally from Source

> [!NOTE]
> For production use, it is recommended to use the NPM package or deploy to Cloudflare Workers.

1.  Clone the repository:
    ```bash
    git clone https://github.com/your-username/firefly-iii-mcp.git
    cd firefly-iii-mcp
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Create a `.dev.vars` file in the root of the project and add your Firefly III URL and PAT:
    ```
    FIREFLY_III_BASE_URL="YOUR_FIREFLY_III_INSTANCE_URL"
    FIREFLY_III_PAT="YOUR_FIREFLY_III_PAT"
    ```
4.  Start the development server:
    ```bash
    npm run dev
    ```
    The server will typically be available at `http://localhost:8787`.

5. (Optional) You can now use the 3rd party gateway like [supergateway](https://github.com/supergateway/supergateway) to connect to the MCP server.
    ```bash
    npx -y supergateway --streamableHttp "http://127.0.0.1:8787/mcp"
    ```

## Acknowledgements

This project utilizes and modifies generation scripts from [harsha-iiiv/openapi-mcp-generator](https://github.com/harsha-iiiv/openapi-mcp-generator). Many thanks to the original authors for their work.

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue.

## License

This project is licensed under the [MIT License](LICENSE).
