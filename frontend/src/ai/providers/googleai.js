import { createOpenAICompatibleProvider } from './_openaiCompatible';

const provider = createOpenAICompatibleProvider({
  name: 'Google AI',
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
  defaultModels: ['gemini-2.5-pro', 'gemini-2.5-flash'],
});

export const { listModels, chat, generateRecommendations, chatAssistant } = provider;
