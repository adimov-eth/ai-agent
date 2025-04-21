module.exports = {
	apps: [
		{
			name: "ai-agent",
			script: "./packages/ai/.mastra/output/index.mjs",
			env: {
				NODE_ENV: "production",
			},
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
			max_memory_restart: "500M",
			error_file: "./logs/telegram-error.log",
			out_file: "./logs/telegram-out.log",
		},
	],
};
