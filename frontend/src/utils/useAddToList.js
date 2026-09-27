import { api as movieApi } from '../api/movieApi';
import { tvApi } from '../api/tvApi';
import { podcastApi } from '../api/podcastApi';
import { bookApi } from '../api/bookApi';
import { useMovies } from './MovieContext';
import { useTVSeries } from './TVSeriesContext';
import { usePodcasts } from './PodcastContext';
import { useBooks } from './BookContext';

// One-tap "put this AI suggestion on my list" — shared by the Recommendations
// cards and the assistant chat so the two can't drift apart.
const ADD_BY_TYPE = {
  movie: (payload) => movieApi.addMovie(payload),
  tv: (payload) => tvApi.addSeries(payload),
  podcast: (payload) => podcastApi.addPodcast(payload),
  book: (payload) => bookApi.addBook(payload),
};

export function useAddToList() {
  const { fetchMovies, deleteMovie } = useMovies();
  const { fetchSeries, deleteSeries } = useTVSeries();
  const { fetchPodcasts, deletePodcast } = usePodcasts();
  const { fetchBooks, deleteBook } = useBooks();

  const REMOVE_BY_TYPE = { movie: deleteMovie, tv: deleteSeries, podcast: deletePodcast, book: deleteBook };
  const REFRESH_BY_TYPE = { movie: fetchMovies, tv: fetchSeries, podcast: fetchPodcasts, book: fetchBooks };

  // Adds a to_watch row and refreshes that type's context. Returns the new
  // row's id, or null when the title was already in the library (409) — the
  // caller treats that as success but has nothing of its own to undo.
  const addToList = async (contentType, { title, genre = null, year = null, artwork_url = null }) => {
    const add = ADD_BY_TYPE[contentType];
    if (!add) throw new Error(`Unknown content type: ${contentType}`);
    try {
      const created = await add({
        title,
        genre,
        release_year: year ? Number(year) || null : null,
        artwork_url,
        status: 'to_watch',
      });
      await REFRESH_BY_TYPE[contentType]();
      return created?.id ?? null;
    } catch (e) {
      if (e?.status === 409) return null;
      throw e;
    }
  };

  // Only ever pass an id that addToList returned this session — never a
  // pre-existing library row.
  const removeFromList = async (contentType, id) => {
    if (id == null) return;
    await REMOVE_BY_TYPE[contentType]?.(id);
  };

  return { addToList, removeFromList };
}
