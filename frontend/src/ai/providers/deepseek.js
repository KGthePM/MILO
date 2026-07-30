import { createOpenAICompatibleProvider } from './_openaiCompatible';

const provider = createOpenAICompatibleProvider({
  name: 'DeepSeek',
  baseUrl: 'https://api.deepseek.com',
  defaultModels: ['deepseek-chat', 'deepseek-reasoner'],
});

export const { listModels, chat, generateRecommendations, chatAssistant } = provider;
