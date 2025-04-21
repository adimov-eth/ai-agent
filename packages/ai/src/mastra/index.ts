import { Mastra } from "@mastra/core";
import { ragObservability } from "../knowledge/config";
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

export const mastra: Mastra = new Mastra({
	agents: {
		realEstateAgent: assistantAgent,
	},
	telemetry: telemetryConfig,
});
