import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { PgVector, PostgresStore } from "@mastra/pg";
import { createVectorQueryTool } from "@mastra/rag";
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
		lastMessages: 30,
		semanticRecall: {
			topK: 3, // Retrieve top 3 similar past messages
			messageRange: 2, // Include 1 message before/after match
		},
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

const propertyKnowledgeBaseSearchTool = createKnowledgeSearchTool(
	"properties", // Pass type
	"Searches the knowledge base for information about properties in Dubai, their prices, locations, and other details.",
);

// Agent Configuration
export const assistantAgent: Agent = new Agent({
	name: "Real Estate Agent",
	instructions: realEstateAgentPrompt,
	model: openai("gpt-4o"),
	tools: {
		knowledgeBaseSearchTool,
		propertyKnowledgeBaseSearchTool,
	},
	memory,
});
