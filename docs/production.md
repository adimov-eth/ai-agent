Ah, let me provide a complete step-by-step guide for initializing and starting the project on a production server:

1. First, clone and set up the project:
```bash
# Clone the repository
git clone <your-repo-url>
cd ai-agent

# Install pnpm if not installed
npm install -g pnpm

# Install dependencies
pnpm install
```

2. Set up environment variables:

Ran tool
Create the following environment files:

```bash
# packages/ai/.env.production
OPENAI_API_KEY=your_key
POSTGRES_CONNECTION_STRING=your_db_connection

# packages/telegram/.env.production
TELEGRAM_BOT_TOKEN=your_bot_token
MASTRA_API_URL=http://localhost:4111
```

3. Build the project:
```bash
# Build all packages
pnpm build
```

4. Install PM2 globally:
```bash
npm install -g pm2
```

5. Create the logs directory and PM2 ecosystem file:
```bash
# Create logs directory
mkdir -p logs

# Create ecosystem.config.js in the project root
```


I apologize for the error. Let me provide the ecosystem.config.js content that you should create in your project root:

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'ai-agent',
      script: 'packages/ai/.mastra/output/index.mjs',
      env: {
        NODE_ENV: 'production'
      },
      max_memory_restart: '1G',
      error_file: 'logs/ai-error.log',
      out_file: 'logs/ai-out.log'
    },
    {
      name: 'telegram-bot',
      script: 'packages/telegram/dist/index.js',
      env: {
        NODE_ENV: 'production'
      },
      max_memory_restart: '500M',
      error_file: 'logs/telegram-error.log',
      out_file: 'logs/telegram-out.log'
    }
  ]
};
```

6. Start the services:
```bash
# Start both services
pm2 start ecosystem.config.js

# Save the process list for auto-restart
pm2 save

# (Optional) Setup PM2 to start on system boot
pm2 startup
```

7. Verify everything is running:
```bash
# Check status
pm2 status

# Check logs
pm2 logs

# Monitor resources
pm2 monit
```

Common PM2 commands for management:
```bash
# Restart services
pm2 restart all

# Stop services
pm2 stop all

# View logs of a specific service
pm2 logs ai-agent
pm2 logs telegram-bot

# Reload services (zero-downtime restart)
pm2 reload all
```

So in summary, on your production server you would run:
```bash
# 1. Clone and setup
git clone <your-repo-url>
cd ai-agent
npm install -g pnpm
pnpm install

# 2. Set up env files
# Create and edit .env.production files in packages/ai and packages/telegram

# 3. Build
pnpm build

# 4. Setup PM2
npm install -g pm2
mkdir -p logs
# Create ecosystem.config.js as shown above

# 5. Start services
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

Would you like me to explain any of these steps in more detail?
