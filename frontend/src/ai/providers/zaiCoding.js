import { createOpenAICompatibleProvider } from './_openaiCompatible';

const provider = createOpenAICompatibleProvider({
  name: 'z.ai Coding',
  baseUrl: 'https://api.z.ai/api/coding/paas/v4',
  defaultModels: ['glm-4.6', 'glm-4.5', 'glm-4.5-air'],
});

export const { listModels, chat, generateRecommendations, chatAssistant } = provider;
