# AI Package

This package implements the Mastra AI agent configuration.

## Environment Setup

Create a `.env` file in this directory with the following variables:

```env
OPENAI_API_KEY=your_openai_key
```

## Development

```bash
# Install dependencies (from root)
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build
```

## Runtime

This package uses Mastra for agent configuration and Bun for building. 