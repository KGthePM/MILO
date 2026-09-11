// Shared by every content-type card. Previously duplicated verbatim in
// MovieCard.jsx and SeriesCard.jsx.
export function getRatingColor(rating) {
  if (rating >= 8) return 'text-green-400';
  if (rating >= 6) return 'text-yellow-400';
  return 'text-red-400';
}
