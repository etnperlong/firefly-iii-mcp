# Contributing to Firefly III MCP

Thank you for your interest in contributing to Firefly III MCP! This project uses Turborepo to manage the monorepo workflow. Here's how to get started.

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/firefly-iii-mcp.git
   cd firefly-iii-mcp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Development Workflow

This project uses [Turborepo](https://turbo.build/) to manage the monorepo and [Changesets](https://github.com/changesets/changesets) for versioning and publishing.

### Common Commands

- **Build all packages**: 
  ```bash
  npm run build
  ```

- **Build a specific package**:
  ```bash
  npm run build:core  # Build the core package
  npm run build:local # Build the local package
  ```

- **Clean build artifacts**:
  ```bash
  npm run clean
  ```

- **Run development mode**:
  ```bash
  npm run dev
  ```

- **Lint code**:
  ```bash
  npm run lint
  ```

### Making Changes

1. Create a new branch for your feature:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes.

3. Build and test your changes:
   ```bash
   npm run build
   npm run test
   ```

4. Create a changeset to document your changes:
   ```bash
   npx changeset
   ```
   Follow the prompts to select the packages you've modified and describe the changes.

5. Commit your changes and push to your branch:
   ```bash
   git add .
   git commit -m "Your detailed commit message"
   git push origin feature/your-feature-name
   ```

6. Open a pull request.

## Versioning and Publishing

When changes are ready to be released:

1. Update package versions:
   ```bash
   npm run version-packages
   ```

2. Review the changes, then commit and push:
   ```bash
   git add .
   git commit -m "Version packages"
   git push
   ```

3. Publish the packages:
   ```bash
   npm run publish-packages
   ```

## Project Structure

```
firefly-iii-mcp/
├── packages/
│   ├── core/             # Core functionality
│   ├── local/            # CLI for local usage
│   └── cloudflare-worker/ # Cloudflare Worker implementation
├── turbo.json            # Turborepo configuration
└── package.json          # Root package.json
```

## Need Help?

If you have any questions or need help, please open an issue on GitHub. 