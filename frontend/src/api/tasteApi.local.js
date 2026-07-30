const API_BASE = '/api';

export const api = {
  async getProfile() {
    const response = await fetch(`${API_BASE}/taste-profile`);
    if (!response.ok) throw new Error('Failed to fetch taste profile');
    return response.json();
  },

  async generateProfile(model = null) {
    const response = await fetch(`${API_BASE}/taste-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(model ? { model } : {}),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to analyze taste');
    }
    return response.json();
  },
};
