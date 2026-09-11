import { genres as screenGenres } from './SearchFilter';
import MobileFilterDropdown from './MobileFilterDropdown';

// `genres` defaults to the screen (movie/TV) list so existing callers are
// unchanged; the Podcasts page passes its own list instead.
export default function GenreFilter({ selectedGenre, onGenreChange, genres = screenGenres }) {
  const genreOptions = genres.map(genre => ({ value: genre, label: genre }));

  return (
    <div className="mb-4">
      <MobileFilterDropdown
        label={selectedGenre}
        options={genreOptions}
        value={selectedGenre}
        onChange={onGenreChange}
        className="w-full"
      />
    </div>
  );
}
