import { Mastra } from "@mastra/core";
import { PgVector } from "@mastra/pg";
import { ragObservability, vectorStoreConfig } from "../knowledge/config";
import { assistantAgent } from "./agents/assistant";

// Map RAGObservabilityConfig to OtelConfig (adjust types if needed)
const telemetryConfig = {
	serviceName: "ai-agent",
	enabled: ragObservability.tracing.enabled,
	sampling: {
		type: "ratio" as const,
		probability: ragObservability.tracing.samplingRate,
	},
	export: {
		type: "otlp" as const,
	},
};

// Define vector store instances
const generalVectorStore = new PgVector({
	connectionString: process.env.POSTGRES_CONNECTION_STRING || "",
});
const propertyVectorStore = new PgVector({
	connectionString: process.env.POSTGRES_CONNECTION_STRING || "",
});

export const mastra: Mastra = new Mastra({
	agents: {
		realEstateAgent: assistantAgent,
	},
	telemetry: telemetryConfig,
	// Register vector stores using the 'vectors' property
	vectors: {
		[vectorStoreConfig.general.indexName]: generalVectorStore,
		[vectorStoreConfig.properties.indexName]: propertyVectorStore,
	},
});
