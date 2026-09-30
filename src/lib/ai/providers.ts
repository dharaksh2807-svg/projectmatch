export type ModelProvider = "google" | "anthropic" | "oss";

export const AI_MODELS: Record<
  string,
  { provider: ModelProvider; modelString: string }
> = {
  "gemini-3.8-flash-medium": {
    provider: "google",
    modelString: "gemini-2.0-flash",
  },
  "gemini-3.7-flash-medium": {
    provider: "google",
    modelString: "gemini-2.0-flash-lite",
  },
  "gemini-3.6-flash-medium": {
    provider: "google",
    modelString: "gemini-1.5-flash",
  },
  "gemini-3.1-pro-high": {
    provider: "google",
    modelString: "gemini-2.5-pro",
  },
  "claude-sonnet-4.6-thinking": {
    provider: "anthropic",
    modelString: "claude-sonnet-4-5",
  },
  "claude-opus-4.6-thinking": {
    provider: "anthropic",
    modelString: "claude-opus-4-5",
  },
  "gpt-oss-120b": {
    provider: "oss",
    modelString: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  },
};
