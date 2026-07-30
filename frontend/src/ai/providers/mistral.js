import { createOpenAICompatibleProvider } from './_openaiCompatible';

const provider = createOpenAICompatibleProvider({
  name: 'Mistral',
  baseUrl: 'https://api.mistral.ai/v1',
  defaultModels: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest'],
});

export const { listModels, chat, generateRecommendations, chatAssistant } = provider;
