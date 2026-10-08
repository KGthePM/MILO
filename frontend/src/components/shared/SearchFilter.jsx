import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import MobileFilterDropdown from './MobileFilterDropdown';
import { MOVIE_GENRE_LIST, TV_GENRE_LIST } from '../../utils/genreColors';

export const genres = ['All', ...MOVIE_GENRE_LIST];
export const tvGenres = ['All', ...TV_GENRE_LIST];

export const dateRangeOptions = ['All time', 'Last 7 days', 'Last 30 days', 'Last 90 days'].map(opt => ({ value: opt, label: opt }));

export const sortOptions = [
  { value: 'most_recent', label: 'Most Recent' },
  { value: 'highest_rated', label: 'Highest Rated' },
  { value: 'lowest_rated', label: 'Lowest Rated' },
  { value: 'title_asc', label: 'Title (A-Z)' },
  { value: 'title_desc', label: 'Title (Z-A)' }
];

function SortDropdown({ sortBy, onSortChange }) {
  return (
    <div className="glass rounded-xl px-3 py-2 sm:px-4 sm:py-2">
      <select
        value={sortBy}
        onChange={(e) => onSortChange(e.target.value)}
        className="bg-transparent text-sm sm:text-base text-white/70 cursor-pointer focus:outline-none"
      >
        {sortOptions.map((option) => (
          <option key={option.value} value={option.value} className="bg-gray-900">
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function SearchFilter({ 
  onSearch, 
  searchTerm, 
  placeholder = 'Search movies...',
  selectedDateRange,
  onDateRangeChange,
  sortBy,
  onSortChange
}) {
  const handleSearch = (value) => {
    onSearch(value);
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex gap-2 sm:gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={20} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={placeholder}
            className="w-full pl-10 pr-4 py-2 sm:py-3 rounded-xl glass text-sm sm:text-base"
          />
        </div>
      </div>

      <div className="flex gap-2 sm:gap-3">
        <MobileFilterDropdown
          label={selectedDateRange}
          options={dateRangeOptions}
          value={selectedDateRange}
          onChange={onDateRangeChange}
          className="w-full"
        />
      </div>

      <div className="flex justify-end">
        <SortDropdown sortBy={sortBy} onSortChange={onSortChange} />
      </div>
    </div>
  );
}
