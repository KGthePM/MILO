import { createOpenAICompatibleProvider } from './_openaiCompatible';

const provider = createOpenAICompatibleProvider({
  name: 'z.ai',
  baseUrl: 'https://api.z.ai/api/paas/v4',
  defaultModels: ['glm-4.6', 'glm-4.5', 'glm-4.5-air'],
  // api.z.ai doesn't support browser CORS — route through the Netlify proxy in cloud mode.
  proxied: true,
  proxyKey: 'zai',
});

export const { listModels, chat, generateRecommendations, chatAssistant } = provider;
