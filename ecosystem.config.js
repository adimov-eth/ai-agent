module.exports = {
	apps: [
		{
			name: "ai-agent",
			script: "./packages/ai/.mastra/output/index.mjs",
			env: {
				NODE_ENV: "production",
			},
			env_production: {
				NODE_ENV: "production",
			},
			env_file: "./packages/ai/.env",
			max_memory_restart: "1G",
			error_file: "./logs/ai-error.log",
			out_file: "./logs/ai-out.log",
		},
		{
			name: "telegram-bot",
			script: "./packages/telegram/dist/index.js",
			env: {
				NODE_ENV: "production",
			},
			env_production: {
				NODE_ENV: "production",
			},
			env_file: "./packages/telegram/.env",
			max_memory_restart: "500M",
			error_file: "./logs/telegram-error.log",
			out_file: "./logs/telegram-out.log",
			instances: 1,
			exec_mode: "fork",
			autorestart: true,
			restart_delay: 4000,
			kill_timeout: 8000,
			wait_ready: true,
		},
	],
};
