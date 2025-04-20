# Telegram Bot Package

This package implements a Telegram bot that interfaces with the Mastra AI agent.

## Environment Setup

Create a `.env` file in this directory with the following variables:

```env
TELEGRAM_BOT_TOKEN=your_bot_token
MASTRA_API_URL=http://localhost:4111
```

## Development

```bash
# Install dependencies (from root)
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

## Runtime

This package uses Bun as its runtime for optimal performance. Make sure you have Bun installed:

```bash
curl -fsSL https://bun.sh/install | bash
```
