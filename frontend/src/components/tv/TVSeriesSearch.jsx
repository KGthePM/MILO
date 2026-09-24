import TitleSearch from '../shared/TitleSearch';
import { searchTV, getTVDetails } from '../../api/tmdbLookup';

const toRow = (r) => ({ key: r.tmdbId, thumb: r.thumb, title: r.title, subtitle: r.year });

// TMDB lookup for the Add/Edit TV modals. Picking a result fetches its details
// (seasons, episodes, genre, poster) before handing the fields to `onPick`;
// getTVDetails never throws, falling back to title + year on failure.
// Callers render this only when TMDB_ENABLED.
export default function TVSeriesSearch({ onPick, initialTerm = '' }) {
  return (
    <TitleSearch
      contentType="tv"
      search={searchTV}
      toRow={toRow}
      onPick={async (r) => onPick(await getTVDetails(r))}
      initialTerm={initialTerm}
      label="Find a series"
      placeholder="Search by series name..."
      failMessage="Couldn't reach the TV database. Fill in the details below instead."
      footnote="TV data from TMDB"
    />
  );
}
