import TitleSearch from '../shared/TitleSearch';
import { searchPodcasts } from '../../api/podcastLookup';

const toRow = (r) => ({ key: r.itunesId, thumb: r.artwork_url, title: r.title, subtitle: r.host });

// Lookup against the iTunes Search API. Shared by the Add and Edit modals;
// `initialTerm` lets the Edit modal seed the box with the podcast's own title.
export default function PodcastSearch({ onPick, initialTerm = '' }) {
  return (
    <TitleSearch
      contentType="podcast"
      search={searchPodcasts}
      toRow={toRow}
      onPick={onPick}
      initialTerm={initialTerm}
      label="Find a podcast"
      placeholder="Search by show name..."
      failMessage="Couldn't reach the podcast directory. Fill in the details below instead."
    />
  );
}
