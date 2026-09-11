import { api } from './movieApi.local';

// Unlike tvApi.local.js (which re-implements fetch against the legacy /api/tv
// route family), podcasts are a thin wrapper over the generic /api/movies
// endpoints, which already accept `type` as a query param / body field. No
// podcast-specific backend routes exist or are needed.
export const podcastApi = {
  getPodcasts: (params = {}) => {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined)
    );
    return api.getMovies({ ...cleanParams, type: 'podcast' });
  },

  addPodcast: (podcast) => api.addMovie({ ...podcast, type: 'podcast' }),

  updatePodcast: (id, podcast) => api.updateMovie(id, { ...podcast, type: 'podcast' }),

  deletePodcast: (id) => api.deleteMovie(id),

  getAnalytics: () => api.getAnalytics({ type: 'podcast' }),

  getRecommendations: (params = {}) => api.getRecommendations({ ...params, content: 'podcast' }),
};
