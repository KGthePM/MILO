import { genres as screenGenres } from './SearchFilter';
import MobileFilterDropdown from './MobileFilterDropdown';

// `genres` defaults to the movie list; the TV, Podcasts and Books pages pass
// their own (TV adds Reality).
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
