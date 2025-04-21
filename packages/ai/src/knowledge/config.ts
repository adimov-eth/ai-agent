import type {
	ChunkingConfig,
	HybridSearchConfig,
	RAGObservabilityConfig,
	VectorStoreConfig,
} from "@dubai/shared/types/rag";

// Vector store configuration
export const vectorStoreConfig: Record<
	"general" | "properties",
	VectorStoreConfig
> = {
	general: {
		indexName: "general_knowledge",
		metadataIndexes: ["type", "location", "category", "lastUpdated"],
	},
	properties: {
		indexName: "property_knowledge",
		metadataIndexes: [
			"projectId",
			"type",
			"location",
			"priceRange.min",
			"priceRange.max",
			"bedrooms",
			"completion",
			"developer",
		],
	},
} as const;

// Chunking configuration
export const chunkingConfig: Record<"general" | "properties", ChunkingConfig> =
	{
		general: {
			strategy: "markdown",
			size: 512,
			overlap: 100,
			preserveStructure: true,
		},
		properties: {
			strategy: "recursive",
			size: 768,
			overlap: 50,
			preserveStructure: true,
		},
	} as const;

// Hybrid search configuration
export const hybridSearchConfig: HybridSearchConfig = {
	weights: {
		semantic: 0.5,
		vector: 0.3,
		metadata: 0.2,
	},
	reranking: {
		model: "gpt-4o-mini",
		topK: 5,
		contextWindow: 3,
	},
} as const;

// Observability configuration
export const ragObservability: RAGObservabilityConfig = {
	metrics: {
		chunkQuality: true,
		retrievalLatency: true,
		embeddingCosts: true,
	},
	tracing: {
		enabled: true,
		samplingRate: 0.1,
	},
	exporters: ["otlp"],
} as const;
