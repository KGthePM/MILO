import { createOpenAICompatibleProvider } from './_openaiCompatible';

const provider = createOpenAICompatibleProvider({
  name: 'xAI',
  baseUrl: 'https://api.x.ai/v1',
  defaultModels: ['grok-4', 'grok-3', 'grok-3-mini'],
});

export const { listModels, chat, generateRecommendations, chatAssistant } = provider;
