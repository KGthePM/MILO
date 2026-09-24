import TitleSearch from '../shared/TitleSearch';
import { searchMovies, getMovieDetails } from '../../api/tmdbLookup';

const toRow = (r) => ({ key: r.tmdbId, thumb: r.thumb, title: r.title, subtitle: r.year });

// TMDB lookup for the Add/Edit Movie modals. Picking a result fetches its
// details (director, genre, poster) before handing the fields to `onPick`;
// getMovieDetails never throws, falling back to title + year on failure.
// Callers render this only when TMDB_ENABLED.
export default function MovieSearch({ onPick, initialTerm = '' }) {
  return (
    <TitleSearch
      contentType="movie"
      search={searchMovies}
      toRow={toRow}
      onPick={async (r) => onPick(await getMovieDetails(r))}
      initialTerm={initialTerm}
      label="Find a movie"
      placeholder="Search by title..."
      failMessage="Couldn't reach the movie database. Fill in the details below instead."
      footnote="Movie data from TMDB"
    />
  );
}
