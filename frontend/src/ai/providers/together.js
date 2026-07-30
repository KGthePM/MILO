import { createOpenAICompatibleProvider } from './_openaiCompatible';

const provider = createOpenAICompatibleProvider({
  name: 'Together',
  baseUrl: 'https://api.together.xyz/v1',
  defaultModels: [
    'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    'Qwen/Qwen2.5-72B-Instruct-Turbo',
  ],
});

export const { listModels, chat, generateRecommendations, chatAssistant } = provider;
