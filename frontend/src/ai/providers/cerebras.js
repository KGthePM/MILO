import { createOpenAICompatibleProvider } from './_openaiCompatible';

const provider = createOpenAICompatibleProvider({
  name: 'Cerebras',
  baseUrl: 'https://api.cerebras.ai/v1',
  defaultModels: ['llama-3.3-70b', 'llama3.1-8b'],
});

export const { listModels, chat, generateRecommendations, chatAssistant } = provider;
