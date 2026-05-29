// engine/providers/gateway.ts
// Vercel AI Gateway wrapper. Lets callers pass "provider/model" strings
// (e.g. "groq/llama-3.3-70b-versatile", "anthropic/claude-sonnet-4-5",
// "mistral/mistral-ocr-latest") without per-provider SDK imports.
//
// In Phase 1 this is a tiny façade. Real reasoning code lands in later phases.

import { gateway } from '@ai-sdk/gateway';

export type ModelId = string; // e.g. "groq/llama-3.3-70b-versatile"

/**
 * Returns an AI SDK model handle. Pass straight to generateText / streamText.
 *
 * Auth: requires AI_GATEWAY_API_KEY in the environment, or — when deployed on
 * Vercel — uses the project's OIDC token automatically.
 */
export function model(id: ModelId) {
  return gateway(id);
}

export const DEFAULT_FAST_MODEL: ModelId = 'groq/llama-3.3-70b-versatile';
export const DEFAULT_REASONING_MODEL: ModelId = 'anthropic/claude-sonnet-4-5';
export const DEFAULT_OCR_MODEL: ModelId = 'mistral/mistral-ocr-latest';
