import { computeInsights } from '../utils/genreInsights';

const API_BASE = '/api';

// The backend's /analytics only returns aggregates; the Stats insights need
// the rows themselves. An insights failure must not take the stats down.
export async function fetchWatchedRows(type) {
  try {
    const response = await fetch(`${API_BASE}/movies?type=${encodeURIComponent(type)}&status=watched`);
    return response.ok ? await response.json() : [];
  } catch {
    return [];
  }
}

export const api = {
  async getMovies(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE}/movies?${queryString}`);
    if (!response.ok) throw new Error('Failed to fetch movies');
    return response.json();
  },

  async addMovie(movie) {
    const response = await fetch(`${API_BASE}/movies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(movie),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const err = new Error(data.error || 'Failed to add movie');
      err.status = response.status;
      err.data = data;
      throw err;
    }
    return response.json();
  },

  async updateMovie(id, movie) {
    const response = await fetch(`${API_BASE}/movies/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(movie),
    });
    if (!response.ok) throw new Error('Failed to update movie');
    return response.json();
  },

  async deleteMovie(id) {
    const response = await fetch(`${API_BASE}/movies/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete movie');
    return response.json();
  },

  async getAnalytics(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const [response, rows] = await Promise.all([
      fetch(`${API_BASE}/analytics${queryString ? `?${queryString}` : ''}`),
      fetchWatchedRows(params.type || 'movie'),
    ]);
    if (!response.ok) throw new Error('Failed to fetch analytics');
    const analytics = await response.json();
    return { ...analytics, insights: computeInsights(rows, params.type || 'movie') };
  },

  async getRecommendations(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE}/recommendations${queryString ? `?${queryString}` : ''}`);
    if (!response.ok) throw new Error('Failed to fetch recommendations');
    return response.json();
  },

  async getOllamaModels() {
    const response = await fetch(`${API_BASE}/ollama/models`);
    if (!response.ok) return { models: [] };
    return response.json();
  },

  async previewLetterboxd(file) {
    const formData = new FormData();
    formData.append('csvFile', file);
    const response = await fetch(`${API_BASE}/letterboxd/preview`, { method: 'POST', body: formData });
    if (!response.ok) throw new Error('Failed to preview Letterboxd data');
    return response.json();
  },

  async importLetterboxd(file) {
    const formData = new FormData();
    formData.append('csvFile', file);
    const response = await fetch(`${API_BASE}/letterboxd/import`, { method: 'POST', body: formData });
    if (!response.ok) throw new Error('Failed to import Letterboxd data');
    return response.json();
  },

  async previewDb(file) {
    const formData = new FormData();
    formData.append('dbFile', file);
    const response = await fetch(`${API_BASE}/db/preview`, { method: 'POST', body: formData });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to preview database file');
    }
    return response.json();
  },

  async importDb(file) {
    const formData = new FormData();
    formData.append('dbFile', file);
    const response = await fetch(`${API_BASE}/db/import`, { method: 'POST', body: formData });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to import database file');
    }
    return response.json();
  },
};
