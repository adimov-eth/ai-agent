# Detailed Phase Implementation Guide

## Phase 1: Base Implementation

### 1. Update Knowledge Ingestion Script

```typescript
// packages/ai/src/scripts/ingest-knowledge.ts

interface BaseMetadata {
  sourceFile: string;
  text: string;
  lastUpdated: string;
}

interface GeneralMetadata extends BaseMetadata {
  type: 'area-guide' | 'market-update' | 'investment-guide';
  location?: string;
  category: string[];
  amenities?: string[];
  priceRange?: PriceRange;
}

interface PropertyMetadata extends BaseMetadata {
  projectId: string;
  type: 'apartment' | 'villa' | 'townhouse' | 'penthouse';
  location: string;
  priceRange: PriceRange;
  bedrooms: number[];
  completion: 'ready' | 'offplan';
  completionDate?: string;
  developer: string;
  amenities: string[];
}

const extractMetadata = async (content: string, filePath: string): Promise<GeneralMetadata | PropertyMetadata> => {
  // Extract frontmatter
  const { data, content: markdownContent } = matter(content);
  
  // Base metadata
  const baseMetadata: BaseMetadata = {
    sourceFile: filePath,
    text: markdownContent,
    lastUpdated: new Date().toISOString(),
  };

  // Determine file type and extract specific metadata
  if (filePath.includes('/properties/')) {
    return extractPropertyMetadata(data, baseMetadata);
  }
  return extractGeneralMetadata(data, baseMetadata);
};

const ingestKnowledge = async (config: IngestConfig) => {
  const { sourceDir, indexName, chunkingStrategy } = config;
  
  // Process files and extract metadata
  const documents = await processFiles(sourceDir);
  
  // Create chunks with metadata
  const chunks = await createChunksWithMetadata(documents, chunkingStrategy);
  
  // Generate embeddings
  const embeddings = await generateEmbeddings(chunks);
  
  // Upsert to vector store
  await upsertToVectorStore(indexName, embeddings, chunks);
};
```

### 2. Configure Vector Stores

```typescript
// packages/ai/src/config/vector-stores.ts

const vectorStoreConfig = {
  general: {
    indexName: 'general_knowledge',
    dimension: 1536, // For text-embedding-3-small
    metadataSchema: {
      type: 'string',
      location: 'string',
      category: 'string[]',
      lastUpdated: 'timestamp',
    },
    indexes: [
      { name: 'type_idx', field: 'type' },
      { name: 'location_idx', field: 'location' },
      { name: 'category_idx', field: 'category', type: 'gin' },
    ],
  },
  properties: {
    indexName: 'property_knowledge',
    dimension: 1536,
    metadataSchema: {
      projectId: 'string',
      type: 'string',
      location: 'string',
      'priceRange.min': 'numeric',
      'priceRange.max': 'numeric',
      bedrooms: 'integer[]',
      completion: 'string',
    },
    indexes: [
      { name: 'project_idx', field: 'projectId' },
      { name: 'location_price_idx', fields: ['location', 'priceRange.min', 'priceRange.max'] },
      { name: 'property_type_idx', field: 'type' },
    ],
  },
};
```

## Phase 2: Enhanced Search

### 1. Hybrid Search Implementation

```typescript
// packages/ai/src/services/search.ts

interface SearchOptions {
  query: string;
  filters?: MetadataFilter;
  weights?: {
    semantic: number;
    vector: number;
    metadata: number;
  };
  topK?: number;
}

class HybridSearchService {
  private readonly vectorStore: PgVector;
  private readonly embeddingModel: typeof EMBEDDING_MODEL;
  private readonly reranker: typeof openai;
  
  async search(options: SearchOptions): Promise<SearchResult[]> {
    // Generate query embedding
    const queryEmbedding = await this.generateQueryEmbedding(options.query);
    
    // Perform vector search
    const vectorResults = await this.vectorSearch(queryEmbedding, options);
    
    // Apply metadata filters
    const filteredResults = this.applyMetadataFilters(vectorResults, options.filters);
    
    // Rerank results
    const rerankedResults = await this.rerank(filteredResults, options.query);
    
    // Apply hybrid scoring
    return this.applyHybridScoring(rerankedResults, options.weights);
  }
  
  private async rerank(results: SearchResult[], query: string): Promise<SearchResult[]> {
    const rerankedResults = await this.reranker.createCompletion({
      model: 'gpt-4o-mini',
      messages: this.buildRerankingPrompt(results, query),
      temperature: 0.0,
    });
    
    return this.parseRerankingResults(rerankedResults, results);
  }
}
```

### 2. Advanced Filtering

```typescript
// packages/ai/src/services/filters.ts

class MetadataFilterBuilder {
  private filters: Record<string, unknown> = {};

  withLocation(location: string | string[]): this {
    this.filters.location = location;
    return this;
  }

  withPriceRange(min?: number, max?: number): this {
    if (min !== undefined || max !== undefined) {
      this.filters.priceRange = { min, max };
    }
    return this;
  }

  withPropertyType(types: string[]): this {
    this.filters.type = types;
    return this;
  }

  build(): MetadataFilter {
    return this.filters as MetadataFilter;
  }
}
```

## Phase 3: Optimization

### 1. Caching Layer

```typescript
// packages/ai/src/services/cache.ts

interface CacheConfig {
  ttl: number;
  maxSize: number;
  strategy: 'lru' | 'lfu';
}

class RAGCache {
  private cache: Map<string, CacheEntry>;
  private readonly config: CacheConfig;
  
  constructor(config: CacheConfig) {
    this.cache = new Map();
    this.config = config;
  }
  
  async get(key: string): Promise<SearchResult[] | null> {
    const entry = this.cache.get(key);
    if (!entry || this.isExpired(entry)) {
      return null;
    }
    return entry.value;
  }
  
  async set(key: string, value: SearchResult[]): Promise<void> {
    this.ensureCapacity();
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      hits: 0,
    });
  }
  
  private generateCacheKey(query: string, filters: MetadataFilter): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify({ query, filters }))
      .digest('hex');
  }
}
```

### 2. Query Optimization

```typescript
// packages/ai/src/services/query-optimizer.ts

class QueryOptimizer {
  private readonly vectorStore: PgVector;
  
  async optimizeQuery(query: string, filters: MetadataFilter): Promise<OptimizedQuery> {
    // Analyze query complexity
    const complexity = this.analyzeQueryComplexity(query);
    
    // Choose optimal chunk size
    const chunkSize = this.determineOptimalChunkSize(complexity);
    
    // Optimize metadata filters
    const optimizedFilters = this.optimizeFilters(filters);
    
    // Determine optimal topK
    const topK = this.calculateOptimalTopK(complexity);
    
    return {
      query,
      filters: optimizedFilters,
      chunkSize,
      topK,
    };
  }
  
  private analyzeQueryComplexity(query: string): QueryComplexity {
    // Implement query complexity analysis
    return {
      length: query.length,
      terms: query.split(' ').length,
      specialTokens: this.countSpecialTokens(query),
    };
  }
}
```

### 3. Telemetry Implementation

```typescript
// packages/ai/src/services/telemetry.ts

class RAGTelemetry {
  private readonly metrics: MetricsClient;
  private readonly tracer: Tracer;
  
  async trackQuery(query: string, results: SearchResult[]): Promise<void> {
    const span = this.tracer.startSpan('rag.query');
    
    try {
      // Track query latency
      const latency = this.measureQueryLatency();
      this.metrics.recordLatency('rag.query.latency', latency);
      
      // Track result quality
      const quality = await this.assessResultQuality(results);
      this.metrics.recordGauge('rag.results.quality', quality);
      
      // Track embedding costs
      const costs = this.calculateEmbeddingCosts(query);
      this.metrics.recordCounter('rag.embedding.costs', costs);
      
    } finally {
      span.end();
    }
  }
  
  private async assessResultQuality(results: SearchResult[]): Promise<number> {
    // Implement result quality assessment
    return this.calculateRelevanceScore(results);
  }
}
```

### 4. Performance Monitoring

```typescript
// packages/ai/src/services/monitoring.ts

class RAGMonitor {
  private readonly metrics: MetricsClient;
  
  async monitorPerformance(): Promise<void> {
    // Monitor cache performance
    this.trackCacheMetrics();
    
    // Monitor vector store performance
    this.trackVectorStoreMetrics();
    
    // Monitor embedding performance
    this.trackEmbeddingMetrics();
    
    // Monitor reranking performance
    this.trackRerankingMetrics();
  }
  
  private async trackCacheMetrics(): Promise<void> {
    this.metrics.recordGauge('rag.cache.hit_rate', this.calculateCacheHitRate());
    this.metrics.recordGauge('rag.cache.size', this.getCurrentCacheSize());
    this.metrics.recordGauge('rag.cache.eviction_rate', this.getEvictionRate());
  }
}
```
