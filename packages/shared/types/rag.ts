// RAG System Types

// Base metadata interface for all knowledge types
export interface BaseKnowledgeMetadata {
	readonly sourceFile: string;
	readonly text: string;
	readonly lastUpdated: string;
}

// Price range type used in both knowledge types
export interface PriceRange {
	readonly min: number;
	readonly max: number;
	readonly currency: string;
}

// General knowledge metadata
export interface GeneralKnowledgeMetadata extends BaseKnowledgeMetadata {
	readonly type: "area-guide" | "market-update" | "investment-guide";
	readonly location?: string;
	readonly category: readonly string[];
	readonly summary?: string;
	readonly amenities?: readonly string[];
	readonly priceRange?: PriceRange;
}

// Property metadata
export interface PropertyKnowledgeMetadata extends BaseKnowledgeMetadata {
	readonly projectId: string;
	readonly type: "apartment" | "villa" | "townhouse" | "penthouse";
	readonly location: string;
	readonly priceRange: PriceRange;
	readonly bedrooms: readonly number[];
	readonly completion: "ready" | "offplan";
	readonly completionDate?: string;
	readonly developer: string;
	readonly amenities: readonly string[];
}

// Vector store configuration
export interface VectorStoreConfig {
	readonly indexName: string;
	readonly metadataIndexes: readonly string[];
}

// Hybrid search configuration
export interface HybridSearchConfig {
	readonly weights: {
		readonly semantic: number;
		readonly vector: number;
		readonly metadata: number;
	};
	readonly reranking: {
		readonly model: string;
		readonly topK: number;
		readonly contextWindow: number;
	};
}

// Metadata filter type
export interface MetadataFilter {
	readonly location?: string | readonly string[];
	readonly priceRange?: {
		readonly min?: number;
		readonly max?: number;
	};
	readonly type?: readonly string[];
	readonly completion?: "ready" | "offplan";
	readonly bedrooms?: readonly number[];
}

// Observability configuration
export interface RAGObservabilityConfig {
	readonly metrics: {
		readonly chunkQuality: boolean;
		readonly retrievalLatency: boolean;
		readonly embeddingCosts: boolean;
	};
	readonly tracing: {
		readonly enabled: boolean;
		readonly samplingRate: number;
	};
	readonly exporters: readonly string[];
}

// Chunking strategies
export interface ChunkingConfig {
	readonly strategy: "markdown" | "recursive";
	readonly size: number;
	readonly overlap: number;
	readonly preserveStructure: boolean;
}
