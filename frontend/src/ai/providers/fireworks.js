import { createOpenAICompatibleProvider } from './_openaiCompatible';

const provider = createOpenAICompatibleProvider({
  name: 'Fireworks',
  baseUrl: 'https://api.fireworks.ai/inference/v1',
  defaultModels: ['accounts/fireworks/models/llama-v3p3-70b-instruct'],
});

export const { listModels, chat, generateRecommendations, chatAssistant } = provider;
