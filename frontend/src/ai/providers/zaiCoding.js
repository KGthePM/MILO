import { createOpenAICompatibleProvider } from './_openaiCompatible';

const provider = createOpenAICompatibleProvider({
  name: 'z.ai Coding',
  baseUrl: 'https://api.z.ai/api/coding/paas/v4',
  defaultModels: ['glm-4.6', 'glm-4.5', 'glm-4.5-air'],
  // api.z.ai doesn't support browser CORS — route through the Netlify proxy in cloud mode.
  proxied: true,
  proxyKey: 'zaiCoding',
  // GLM's "thinking" (extended reasoning) mode defaults to enabled and can
  // push generation past the host platform's function execution limit. Ask for
  // it off everywhere. Some models ignore the field and newer ones reject it
  // outright — _openaiCompatible retries without it on a 400, so this can only
  // help.
  jsonGenerationExtraBody: { thinking: { type: 'disabled' } },
  assistantExtraBody: { thinking: { type: 'disabled' } },
  // Tokens arrive as they're produced, so a request cut short by the proxy's
  // execution budget still returns usable text instead of an opaque 502.
  supportsStreaming: true,
  // Headroom against that budget; truncated JSON is salvaged downstream.
  jsonGenerationMaxTokens: 3000,
});

export const {
  listModels,
  chat,
  generateRecommendations,
  chatAssistant,
  jsonGenerationExtraBody,
  jsonGenerationMaxTokens,
} = provider;
