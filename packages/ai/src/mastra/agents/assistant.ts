import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { Memory } from "@mastra/memory";
import { PgVector, PostgresStore } from "@mastra/pg";
import { createVectorQueryTool } from "@mastra/rag";
import axios from "axios";
import { z } from "zod";
import { hybridSearchConfig, vectorStoreConfig } from "../../knowledge/config"; // Import config
import { realEstateAgentPrompt, workingMemoryTemplate } from "../prompts";

// Constants
const EMBEDDING_MODEL = openai.embedding("text-embedding-3-small");

// Memory Configuration
const memory = new Memory({
	storage: new PostgresStore({
		connectionString: process.env.POSTGRES_CONNECTION_STRING || "",
	}),
	vector: new PgVector({
		connectionString: process.env.POSTGRES_CONNECTION_STRING || "",
	}),
	options: {
		lastMessages: 20,
		// semanticRecall: {
		// 	topK: 3, // Retrieve top 3 similar past messages
		// 	messageRange: 2, // Include 1 message before/after match
		// },
		workingMemory: {
			enabled: true,
			template: workingMemoryTemplate,
			use: "tool-call", // Use tool calls for working memory updates
		},
		threads: {
			generateTitle: true, // Auto-generate thread titles from first message
		},
	},
});

// Vector Search Tools
const createKnowledgeSearchTool = (
	type: "general" | "properties", // Use type to get specific config
	description: string,
) => {
	const storeConfig = vectorStoreConfig[type];
	const rerankerConfig = hybridSearchConfig.reranking; // Use imported config

	return createVectorQueryTool({
		vectorStoreName: storeConfig.indexName, // Use store name from config
		indexName: storeConfig.indexName,
		model: EMBEDDING_MODEL,
		description,
		reranker: {
			model: openai(rerankerConfig.model), // Use model from config
			options: {
				// Explicitly define options based on imported config
				topK: rerankerConfig.topK,
				// weights: hybridSearchConfig.weights, // Assuming reranker uses these implicitly or define if needed
			},
		},
	});
};

const knowledgeBaseSearchTool = createKnowledgeSearchTool(
	"general", // Pass type
	"Searches the knowledge base for general information and facts about Dubai, its districts and neighborhoods.",
);

// const propertyKnowledgeBaseSearchTool = createKnowledgeSearchTool(
// 	"properties", // Pass type
// 	"Searches the knowledge base for information about properties in Dubai, their prices, locations, and other details.",
// );

const sendTelegramMessage = async (message: string) => {
	const telegramChatId = "208409637"; // Replace with the actual chat ID
	const telegramMessage = `${message}`;

	const telegramUrl =
		"https://api.telegram.org/bot7780911583:AAE38Wx1nBhMAcmzQPuYhFobbOUuM1ZD5WU/sendMessage"; // Replace with your bot token
	const payload = {
		chat_id: telegramChatId,
		text: telegramMessage,
	};
	await axios.post(telegramUrl, payload);
	return "Message sent successfully";
};

const notifyManagerTool = createTool({
	id: "Send Telegram Message to a Manager",
	description: "Sends a message to a Manager via Telegram",
	inputSchema: z.object({
		message: z.string(),
	}),
	execute: async ({ context: { message } }) => {
		await sendTelegramMessage(message);
		return "Message sent successfully to manager";
	},
});

// Agent Configuration
export const assistantAgent: Agent = new Agent({
	name: "Real Estate Agent",
	instructions: realEstateAgentPrompt,
	model: openai("gpt-4o"),
	tools: {
		knowledgeBaseSearchTool,
		notifyManagerTool,
	},
	memory,
});
