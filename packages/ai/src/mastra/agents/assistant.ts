import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";

export const assistantAgent = new Agent({
	name: "Telegram Assistant",
	instructions:
		"You are a helpful Telegram bot assistant. Be concise and friendly.",
	model: openai("gpt-4-turbo-preview"),
});
