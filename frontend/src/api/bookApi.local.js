import { api } from './movieApi.local';

// Same shape as podcastApi.local.js: books are a thin wrapper over the generic
// /api/movies endpoints with `type: 'book'`. No book-specific backend routes.
export const bookApi = {
  getBooks: (params = {}) => {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined)
    );
    return api.getMovies({ ...cleanParams, type: 'book' });
  },

  addBook: (book) => api.addMovie({ ...book, type: 'book' }),

  updateBook: (id, book) => api.updateMovie(id, { ...book, type: 'book' }),

  deleteBook: (id) => api.deleteMovie(id),

  getAnalytics: () => api.getAnalytics({ type: 'book' }),

  getRecommendations: (params = {}) => api.getRecommendations({ ...params, content: 'book' }),

  // Goodreads import. The local backend has no bulk endpoint, so rows go in one
  // at a time — fine against localhost. A 409 means the title slipped past the
  // client-side de-dupe; it's skipped rather than failing the whole import.
  async importBooks(books) {
    let imported = 0;
    for (const book of books) {
      try {
        await api.addMovie({ ...book, type: 'book' });
        imported += 1;
      } catch (err) {
        if (err?.status !== 409) throw err;
      }
    }
    return { imported };
  },
};
