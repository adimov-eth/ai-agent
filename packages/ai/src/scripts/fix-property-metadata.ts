import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const PROPERTIES_DIR = path.resolve("src/knowledge/properties");

// Validation constants
const PROJECT_ID_REGEX = /^[A-Z0-9]{2,10}$/;
const VALID_AMENITIES = [
	"pool",
	"gym",
	"parking",
	"security",
	"beach-access",
	"concierge",
	"spa",
	"garden",
	"playground",
	"bbq-area",
] as const;

const VALID_LOCATIONS = [
	"Dubai Marina",
	"Downtown Dubai",
	"Palm Jumeirah",
	"Business Bay",
	"JBR",
	"Dubai Hills Estate",
	"Arabian Ranches",
	"Emirates Living",
	"Dubai Creek Harbour",
	"JVC",
	"JVC (Jumeirah Village Circle)",
	"Jumeirah Village Circle",
	"Sobha Hartland",
	"Beach Front",
	"Dubai South",
	"Dubai Land",
	"Motor City",
	"Al Barsha",
	"Meydan",
	"MBR City",
	"Dubai Silicon Oasis",
	"Dubai Sports City",
	"International City",
	"Al Furjan",
	"Jumeirah Lake Towers",
	"JLT",
	"The Palm",
	"Dubai Hills",
	"DAMAC Hills",
	"Arabian Ranches 3",
	"Dubai Studio City",
	"Jumeirah Beach Residence",
] as const;

// Price extraction regex patterns
const PRICE_PATTERNS = [
	/Price Range:\s*AED\s*([\d,]+)/gi,
	/Price:\s*AED\s*([\d,]+)/gi,
	/AED\s*([\d,]+)/gi,
	/Price Range:\s*(\d[\d,]*)\s*AED/gi,
	/Price:\s*(\d[\d,]*)\s*AED/gi,
	/(\d[\d,]*)\s*AED/gi,
	/Starting Price:\s*AED\s*([\d,]+)/gi,
	/Starting from AED\s*([\d,]+)/gi,
	/From AED\s*([\d,]+)/gi,
	/Prices from AED\s*([\d,]+)/gi,
	/Starting at AED\s*([\d,]+)/gi,
	/Price starting at AED\s*([\d,]+)/gi,
];

interface ValidationStats {
	totalFiles: number;
	processedFiles: number;
	modifiedFiles: number;
	errors: Array<{ file: string; error: string }>;
	modifiedFields: Record<string, number>;
}

interface PropertyData {
	id: number;
	title: string;
	districtName: string;
	type: "apartment" | "villa" | "townhouse" | "penthouse";
	location: string;
	developer: string;
	completion: "ready" | "offplan";
	completionDate?: string;
	priceMin: number;
	priceMax: number;
	currency: string;
	bedrooms: number[];
	amenities: string[];
	projectId: string;
}

const stats: ValidationStats = {
	totalFiles: 0,
	processedFiles: 0,
	modifiedFiles: 0,
	errors: [],
	modifiedFields: {},
};

function trackFieldModification(field: keyof PropertyData) {
	stats.modifiedFields[field] = (stats.modifiedFields[field] || 0) + 1;
}

function extractPriceFromContent(
	content: string,
): { min: number; max: number } | null {
	let bestMatch: number | null = null;

	for (const pattern of PRICE_PATTERNS) {
		const matches = content.matchAll(pattern);
		for (const match of matches) {
			const price = Number(match[1].replace(/,/g, ""));
			if (!Number.isNaN(price) && price > 0) {
				if (!bestMatch || price < bestMatch) {
					bestMatch = price;
				}
			}
		}
	}

	if (bestMatch) {
		// Use the lowest found price as min and add 20% for max as a fallback
		return { min: bestMatch, max: Math.ceil(bestMatch * 1.2) };
	}

	return null;
}

async function readMarkdownFiles(): Promise<
	{ filePath: string; content: string }[]
> {
	const entries = await fs.readdir(PROPERTIES_DIR, { withFileTypes: true });
	const files = entries
		.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
		.map(async (entry) => {
			const fullPath = path.resolve(PROPERTIES_DIR, entry.name);
			const content = await fs.readFile(fullPath, "utf-8");
			return { filePath: fullPath, content };
		});
	return Promise.all(files);
}

function validateAndFixMetadata(
	data: Record<string, unknown>,
	originalData: Record<string, unknown>,
	content: string,
): PropertyData {
	const fixedData: PropertyData = {
		id: Number(data.id) || 0,
		title: String(data.title || ""),
		districtName: String(data.districtName || ""),
		type: String(data.type || "apartment") as PropertyData["type"],
		location: String(data.location || ""),
		developer: String(data.developer || ""),
		completion: String(data.completion || "ready") as "ready" | "offplan",
		completionDate: data.completionDate
			? String(data.completionDate)
			: undefined,
		priceMin: Number(data.priceMin) || 0,
		priceMax: Number(data.priceMax) || 0,
		currency: String(data.currency || "AED"),
		bedrooms: Array.isArray(data.bedrooms) ? data.bedrooms.map(Number) : [1],
		amenities: Array.isArray(data.amenities) ? data.amenities.map(String) : [],
		projectId: String(data.projectId || data.id || ""),
	};

	// Track modifications
	for (const key of Object.keys(fixedData)) {
		const k = key as keyof PropertyData;
		if (JSON.stringify(fixedData[k]) !== JSON.stringify(originalData[k])) {
			trackFieldModification(k);
		}
	}

	// Validate projectId format
	if (!PROJECT_ID_REGEX.test(fixedData.projectId)) {
		fixedData.projectId = String(fixedData.id).padStart(4, "0");
		trackFieldModification("projectId");
	}

	// Validate location
	if (
		!VALID_LOCATIONS.includes(
			fixedData.location as (typeof VALID_LOCATIONS)[number],
		)
	) {
		console.warn(`Warning: Invalid location "${fixedData.location}"`);
	}

	// Try to extract price from content if not in frontmatter
	if (fixedData.priceMin <= 0 || fixedData.priceMax <= 0) {
		const extractedPrice = extractPriceFromContent(content);
		if (extractedPrice) {
			fixedData.priceMin = extractedPrice.min;
			fixedData.priceMax = extractedPrice.max;
			trackFieldModification("priceMin");
			trackFieldModification("priceMax");
		} else {
			// If no price found, set default values
			fixedData.priceMin = 0;
			fixedData.priceMax = 0;
			trackFieldModification("priceMin");
			trackFieldModification("priceMax");
		}
	}

	// Ensure priceMin is less than or equal to priceMax
	if (fixedData.priceMin > fixedData.priceMax) {
		const temp = fixedData.priceMin;
		fixedData.priceMin = fixedData.priceMax;
		fixedData.priceMax = temp;
		trackFieldModification("priceMin");
		trackFieldModification("priceMax");
	}

	// Validate bedrooms
	fixedData.bedrooms = fixedData.bedrooms.filter(
		(bed) => !Number.isNaN(bed) && bed >= 0,
	);
	if (fixedData.bedrooms.length === 0) {
		fixedData.bedrooms = [1];
		trackFieldModification("bedrooms");
	}

	// Validate amenities against predefined list
	const originalAmenities = fixedData.amenities;
	fixedData.amenities = fixedData.amenities.filter((amenity) =>
		VALID_AMENITIES.includes(amenity as (typeof VALID_AMENITIES)[number]),
	);
	if (fixedData.amenities.length !== originalAmenities.length) {
		trackFieldModification("amenities");
	}

	// Remove undefined values to prevent YAML errors
	const cleanData = Object.entries(fixedData).reduce<PropertyData>(
		(acc, [key, value]) => {
			if (value !== undefined && key in fixedData) {
				const typedKey = key as keyof PropertyData;
				(acc[typedKey] as PropertyData[typeof typedKey]) =
					value as PropertyData[typeof typedKey];
			}
			return acc;
		},
		{
			id: 0,
			title: "",
			districtName: "",
			type: "apartment",
			location: "",
			developer: "",
			completion: "ready",
			priceMin: 0,
			priceMax: 0,
			currency: "AED",
			bedrooms: [],
			amenities: [],
			projectId: "",
		} as PropertyData,
	);

	return cleanData;
}

function generateUpdatedContent(
	filePath: string,
	originalContent: string,
	isDryRun: boolean,
): { content: string; modified: boolean } {
	const { data: frontMatter, content } = matter(originalContent);
	let modified = false;

	try {
		const fixedData = validateAndFixMetadata(
			frontMatter,
			frontMatter,
			originalContent,
		);
		const updatedContent = matter.stringify(content, fixedData);
		modified = updatedContent !== originalContent;
		return { content: isDryRun ? originalContent : updatedContent, modified };
	} catch (error) {
		stats.errors.push({ file: path.basename(filePath), error: String(error) });
		return { content: originalContent, modified: false };
	}
}

async function generateReport() {
	const report = {
		summary: {
			totalFiles: stats.totalFiles,
			processedFiles: stats.processedFiles,
			modifiedFiles: stats.modifiedFiles,
			errorCount: stats.errors.length,
		},
		modifiedFields: stats.modifiedFields,
		errors: stats.errors,
	};

	const reportPath = path.join(PROPERTIES_DIR, "validation-report.json");
	await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
	return reportPath;
}

async function main() {
	const isDryRun = process.argv.includes("--dry-run");
	console.log(
		isDryRun ? "Running in dry-run mode..." : "Running in update mode...",
	);

	try {
		console.log("Reading property files...");
		const files = await readMarkdownFiles();
		stats.totalFiles = files.length;
		console.log(`Found ${files.length} files to process`);

		for (const file of files) {
			console.log(`Processing ${path.basename(file.filePath)}...`);
			const { content, modified } = generateUpdatedContent(
				file.filePath,
				file.content,
				isDryRun,
			);

			if (modified) {
				stats.modifiedFiles++;
				if (!isDryRun) {
					await fs.writeFile(file.filePath, content, "utf-8");
				}
			}
			stats.processedFiles++;
		}

		const reportPath = await generateReport();
		console.log("\nValidation complete!");
		console.log(`- Total files: ${stats.totalFiles}`);
		console.log(`- Modified files: ${stats.modifiedFiles}`);
		console.log(`- Errors: ${stats.errors.length}`);
		console.log(`\nDetailed report saved to: ${reportPath}`);
	} catch (error) {
		console.error("Error:", error);
		process.exit(1);
	}
}

// Allow importing for testing
export { validateAndFixMetadata, generateUpdatedContent };

// Run if called directly
if (require.main === module) {
	main();
}
