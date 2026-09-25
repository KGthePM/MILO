import { useState } from 'react';
import { accentFor, iconFor } from '../../utils/contentTypes';

// Card artwork for every content type: square cover art for podcasts, a 2:3
// poster for movies, TV, and books. The sizes are complete literal strings so Tailwind
// keeps them in the build. SkeletonGrid uses the same shapes so nothing jumps
// when the data lands.
export const COVER_SIZE = {
  square: 'w-16 h-16 sm:w-20 sm:h-20',
  poster: 'w-14 sm:w-16 aspect-[2/3]',
};

export const coverShapeFor = (contentType) => (contentType === 'podcast' ? 'square' : 'poster');

// Falls back to an accent-tinted type-icon tile, so a record with no artwork
// still has the same card shape. If the image fails to load, it shows that
// tile instead of a broken-image glyph.
export default function CoverArt({ contentType, src, title }) {
  // Keyed to the src so a newly picked poster gets a fresh attempt.
  const [failedSrc, setFailedSrc] = useState(null);
  const failed = failedSrc === src;
  const accent = accentFor(contentType);
  const Icon = iconFor(contentType);
  const size = COVER_SIZE[coverShapeFor(contentType)];

  if (!src || failed) {
    return (
      <div className={`${size} rounded-lg border flex items-center justify-center flex-shrink-0 ${accent.tileSoft} ${accent.edgeSoft}`}>
        <Icon size={24} className={accent.iconSoft} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${title} ${contentType === 'podcast' || contentType === 'book' ? 'cover' : 'poster'}`}
      loading="lazy"
      onError={() => setFailedSrc(src)}
      className={`${size} rounded-lg object-cover flex-shrink-0 border border-white/10`}
    />
  );
}
