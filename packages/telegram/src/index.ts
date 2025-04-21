import { Bot } from "grammy";
import { type AgentResponse, Message } from "../../shared/types";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MASTRA_API_URL = process.env.MASTRA_API_URL || "http://localhost:4111";
const AGENT_ID = "realEstateAgent";

if (!BOT_TOKEN) {
	throw new Error("TELEGRAM_BOT_TOKEN is required");
}

const bot = new Bot(BOT_TOKEN);

async function callAgent(
	message: string,
	userId: string,
	chatId: string,
): Promise<AgentResponse | null> {
	try {
		const response = await fetch(
			`${MASTRA_API_URL}/api/agents/${AGENT_ID}/generate`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					messages: [{ role: "user", content: message }],
					resourceId: `telegram-user-${userId}`, // Unique user identifier
					threadId: `telegram-chat-${chatId}`, // Unique chat/thread identifier
				}),
			},
		);

		if (!response.ok) return null;
		return response.json();
	} catch (error) {
		console.error("Agent API error:", error);
		return null;
	}
}

bot.on("message:text", async (ctx) => {
	await ctx.replyWithChatAction("typing");

	const userId = ctx.from?.id.toString();
	const chatId = ctx.chat.id.toString();

	if (!userId) {
		await ctx.reply("Sorry, I couldn't identify you. Please try again.");
		return;
	}

	const response = await callAgent(ctx.message.text, userId, chatId);

	if (response?.text) {
		await ctx.reply(response.text);
	} else {
		await ctx.reply("Sorry, I'm having trouble processing your request.");
	}
});

bot.command("start", async (ctx) => {
	const userId = ctx.from?.id.toString();
	const chatId = ctx.chat.id.toString();

	if (!userId) {
		await ctx.reply("Sorry, I couldn't identify you. Please try again.");
		return;
	}

	const response = await callAgent(
		"Hi! I'm starting a new conversation.",
		userId,
		chatId,
	);

	if (response?.text) {
		await ctx.reply(response.text);
	} else {
		await ctx.reply("Hello! I'm your AI assistant. How can I help?");
	}
});

bot.catch((err) => {
	console.error("Bot error:", err);
});

// Graceful shutdown handling
const shutdown = async () => {
	console.log("Shutting down bot...");
	await bot.stop();
	process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Start bot
console.log("Starting Telegram bot...");
await bot.start();

// Signal ready to PM2
if (process.send) {
	process.send("ready");
}
