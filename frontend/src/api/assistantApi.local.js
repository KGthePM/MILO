const API_BASE = '/api';

export const assistantApi = {
  // `options` (e.g. { onToken }) is accepted for signature parity with the
  // cloud client; the local backend returns the reply in one piece.
  async chatWithAssistant(message, model = null, movies = [], tvSeries = [], analytics = null, history = [], options = {}) { // eslint-disable-line no-unused-vars
    const response = await fetch(`${API_BASE}/assistant/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, model, movies, tvSeries, analytics, history }),
    });
    if (!response.ok) throw new Error('Failed to get response from MILO');
    return response.json();
  },

  async getOllamaModels() {
    const response = await fetch(`${API_BASE}/ollama/models`);
    if (!response.ok) return { models: [] };
    return response.json();
  },
};
