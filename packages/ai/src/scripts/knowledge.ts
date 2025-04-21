import fs from "node:fs/promises";
import path from "node:path";
import { openai } from "@ai-sdk/openai";
import type {
	GeneralKnowledgeMetadata,
	PriceRange,
	PropertyKnowledgeMetadata,
} from "@dubai/shared/types/rag";
import { PgVector } from "@mastra/pg";
import { MDocument } from "@mastra/rag";
import { embedMany } from "ai";
import matter from "gray-matter";
import { chunkingConfig, vectorStoreConfig } from "../knowledge/config";

// Ensure environment variables are loaded
import "dotenv/config";

const args = process.argv.slice(2);
const shouldValidate = args.includes("--validate");
const shouldIngest = args.includes("--ingest");

if (!shouldValidate && !shouldIngest) {
	console.error("Please specify --validate and/or --ingest");
	process.exit(1);
}

console.log("Connecting to vector store...");

interface ChunkWithMetadata {
	text: string;
	metadata: GeneralKnowledgeMetadata | PropertyKnowledgeMetadata;
}

async function readMarkdownFiles(
	dir: string,
): Promise<{ filePath: string; content: string }[]> {
	const absoluteDir = path.resolve(dir);
	console.log(`Reading markdown files from: ${absoluteDir}`);
	const entries = await fs.readdir(absoluteDir, { withFileTypes: true });
	const files = await Promise.all(
		entries.map(async (entry) => {
			const fullPath = path.resolve(absoluteDir, entry.name);
			if (entry.isDirectory()) {
				return readMarkdownFiles(fullPath);
			}
			if (entry.isFile() && entry.name.endsWith(".md")) {
				const content = await fs.readFile(fullPath, "utf-8");
				return [{ filePath: fullPath, content }];
			}
			return [];
		}),
	);
	return files.flat();
}

function extractPriceRange(
	data: Record<string, unknown>,
): PriceRange | undefined {
	// Try flat format first (priceMin, priceMax)
	let min = Number(data.priceMin);
	let max = Number(data.priceMax);
	let currency = String(data.currency || "AED");

	// If flat format fails, try nested format (price.min, price.max)
	if (Number.isNaN(min) || Number.isNaN(max)) {
		const price = data.price as Record<string, unknown>;
		if (price) {
			min = Number(price.min);
			max = Number(price.max);
			currency = String(price.currency || "AED");
		}
	}

	if (Number.isNaN(min) || Number.isNaN(max)) {
		return undefined;
	}

	return { min, max, currency };
}

function extractPropertyMetadata(
	data: Record<string, unknown>,
	filePath: string,
	content: string,
): PropertyKnowledgeMetadata {
	const priceRange = extractPriceRange(data);
	if (!priceRange) {
		throw new Error(`Invalid price range in ${filePath}`);
	}

	// Handle template files differently
	if (filePath.endsWith("_template.md")) {
		return {
			projectId: String(data.projectId || "template"),
			type: String(
				data.type || "apartment",
			) as PropertyKnowledgeMetadata["type"],
			location: String(data.location || "Dubai"),
			priceRange,
			bedrooms: [1, 2, 3], // Default template values
			completion: String(data.status || "ready") as "ready" | "offplan",
			completionDate: data.completionDate
				? String(data.completionDate)
				: undefined,
			developer: String(data.developer || "Developer Name"),
			amenities: Array.isArray(data.amenities)
				? data.amenities.map(String)
				: [],
			sourceFile: filePath,
			text: content,
			lastUpdated: new Date().toISOString(),
		};
	}

	// Regular file processing
	const bedrooms = Array.isArray(data.bedrooms)
		? data.bedrooms.map(Number)
		: [Number(data.bedrooms)];

	if (bedrooms.some(Number.isNaN)) {
		throw new Error(`Invalid bedrooms in ${filePath}`);
	}

	return {
		projectId: String(data.projectId),
		type: String(data.type) as PropertyKnowledgeMetadata["type"],
		location: String(data.location),
		priceRange,
		bedrooms,
		completion: String(data.completion) as "ready" | "offplan",
		completionDate: data.completionDate
			? String(data.completionDate)
			: undefined,
		developer: String(data.developer),
		amenities: Array.isArray(data.amenities) ? data.amenities.map(String) : [],
		sourceFile: filePath,
		text: content,
		lastUpdated: new Date().toISOString(),
	};
}

function extractGeneralMetadata(
	data: Record<string, unknown>,
	filePath: string,
	content: string,
): GeneralKnowledgeMetadata {
	return {
		type: String(data.type) as GeneralKnowledgeMetadata["type"],
		location: data.location ? String(data.location) : undefined,
		category: Array.isArray(data.category) ? data.category.map(String) : [],
		summary: data.summary ? String(data.summary) : undefined,
		amenities: Array.isArray(data.amenities)
			? data.amenities.map(String)
			: undefined,
		priceRange: extractPriceRange(data),
		sourceFile: filePath,
		text: content,
		lastUpdated: new Date().toISOString(),
	};
}

async function validateKnowledge(): Promise<void> {
	console.log("Validating knowledge files...");
	try {
		// Read and validate general knowledge
		const generalFiles = await readMarkdownFiles(
			path.resolve("src/knowledge/general"),
		);
		for (const file of generalFiles) {
			const { data } = matter(file.content);
			extractGeneralMetadata(data, file.filePath, file.content);
		}
		console.log("✓ General knowledge files validated");

		// Read and validate property knowledge
		const propertyFiles = await readMarkdownFiles(
			path.resolve("src/knowledge/properties"),
		);
		for (const file of propertyFiles) {
			const { data } = matter(file.content);
			extractPropertyMetadata(data, file.filePath, file.content);
		}
		console.log("✓ Property knowledge files validated");
	} catch (error) {
		console.error("Knowledge validation failed:", error);
		process.exit(1);
	}
}

async function setupVectorStore(): Promise<PgVector> {
	const connectionString = process.env.POSTGRES_CONNECTION_STRING;
	if (typeof connectionString !== "string") {
		console.error(
			"POSTGRES_CONNECTION_STRING environment variable is not set. Aborting.",
		);
		process.exit(1);
	}

	console.log("Connecting to vector store...");
	return new PgVector({ connectionString });
}

async function main() {
	if (shouldValidate) {
		await validateKnowledge();
	}

	if (shouldIngest) {
		const vectorStore = await setupVectorStore();
		try {
			// Ingest general knowledge
			await ingestKnowledge(
				path.resolve("src/knowledge/general"),
				"general",
				vectorStore,
			);

			// Ingest property knowledge
			await ingestKnowledge(
				path.resolve("src/knowledge/properties"),
				"properties",
				vectorStore,
			);
		} finally {
			await vectorStore.disconnect?.();
		}
	}
}

export async function ingestKnowledge(
	knowledgeDir: string,
	type: "general" | "properties",
	vectorStore: PgVector,
): Promise<void> {
	const config = vectorStoreConfig[type];
	const chunking = chunkingConfig[type];
	const EMBEDDING_MODEL = openai.embedding("text-embedding-3-small");
	const VECTOR_DIMENSION = 1536;

	console.log(
		`Starting ${type} knowledge ingestion for index '${config.indexName}' from '${knowledgeDir}'...`,
	);

	const markdownFiles = await readMarkdownFiles(knowledgeDir);
	let allChunks: ChunkWithMetadata[] = [];

	console.log(`Found ${markdownFiles.length} markdown files. Processing...`);

	for (const file of markdownFiles) {
		console.log(`Processing: ${file.filePath}`);

		// Extract frontmatter and content
		const { data, content } = matter(file.content);

		// Extract metadata based on type
		const metadata =
			type === "properties"
				? extractPropertyMetadata(data, file.filePath, content)
				: extractGeneralMetadata(data, file.filePath, content);

		// Create document and chunk it
		const doc = MDocument.fromMarkdown(content, metadata);
		await doc.chunk({
			strategy: chunking.strategy,
			size: chunking.size,
			overlap: chunking.overlap,
		});

		// Process chunks while preserving metadata
		const processedChunks: ChunkWithMetadata[] = doc.getDocs().map((chunk) => ({
			text: chunk.text,
			metadata: {
				...metadata,
				text: chunk.text,
			},
		}));

		allChunks = allChunks.concat(processedChunks);
	}

	console.log(`Total chunks created: ${allChunks.length}`);
	if (allChunks.length === 0) {
		console.log("No chunks to process. Exiting.");
		return;
	}

	console.log("Generating embeddings...");
	const { embeddings } = await embedMany({
		model: EMBEDDING_MODEL,
		values: allChunks.map((chunk) => chunk.text),
	});
	console.log(`Generated ${embeddings.length} embeddings.`);

	if (embeddings.length !== allChunks.length) {
		console.error(
			"Mismatch between number of chunks and embeddings. Aborting.",
		);
		return;
	}

	try {
		// Create index without metadata indexes as they're not supported in the current version
		await vectorStore.createIndex({
			indexName: config.indexName,
			dimension: VECTOR_DIMENSION,
		});
		console.log(`Index '${config.indexName}' created or already exists.`);
	} catch (error: unknown) {
		if (error instanceof Error && error.message.includes("already exists")) {
			console.log(`Index '${config.indexName}' already exists.`);
		} else {
			console.error("Error creating index:", error);
			return;
		}
	}

	console.log("Upserting embeddings and metadata...");
	try {
		await vectorStore.upsert({
			indexName: config.indexName,
			vectors: embeddings,
			metadata: allChunks.map((chunk) => chunk.metadata),
		});
		console.log("Ingestion complete!");
	} catch (error) {
		console.error("Error upserting data:", error);
	}
}

main().catch((error) => {
	console.error("Error:", error);
	process.exit(1);
});
