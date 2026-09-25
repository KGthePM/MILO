import TitleSearch from '../shared/TitleSearch';
import { searchBooks } from '../../api/bookLookup';

const toRow = (r) => ({
  key: r.olKey,
  thumb: r.thumb_url,
  title: r.title,
  subtitle: [r.author, r.release_year].filter(Boolean).join(' · '),
});

// Lookup against Open Library. Shared by the Add and Edit modals;
// `initialTerm` lets the Edit modal seed the box with the book's own title.
export default function BookSearch({ onPick, initialTerm = '' }) {
  return (
    <TitleSearch
      contentType="book"
      search={searchBooks}
      toRow={toRow}
      onPick={onPick}
      initialTerm={initialTerm}
      label="Find a book"
      placeholder="Search by title or author..."
      failMessage="Couldn't reach Open Library. Fill in the details below instead."
      footnote="Book data and covers from Open Library."
    />
  );
}
