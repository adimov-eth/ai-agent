export interface Message {
	role: "user" | "assistant" | "system";
	content: string;
}

export interface AgentResponse {
	text: string;
	toolCalls?: unknown[];
}
