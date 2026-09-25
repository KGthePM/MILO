export function parseCSVText(text) {
  const rows = [];
  let i = 0;
  let field = '';
  let row = [];
  let inQuotes = false;

  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { rows.push(row); row = []; };

  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { pushField(); i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { pushField(); pushRow(); i++; continue; }
    field += c; i++;
  }
  if (field.length > 0 || row.length > 0) { pushField(); pushRow(); }
  return rows;
}

export async function parseLetterboxdCSV(file) {
  const text = await file.text();
  const rows = parseCSVText(text).filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ''));
  if (rows.length === 0) return [];
  const headers = rows[0];
  return rows.slice(1).map((cols) => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = cols[idx]; });
    return obj;
  });
}

export function processLetterboxdRows(csvData, existingTitles = new Set()) {
  const moviesToImport = [];
  const skippedNoRating = [];
  const duplicates = [];

  for (const row of csvData) {
    const Name = row.Name || row.name || row.Title;
    const Rating = row.Rating || row.rating;
    const Date = row.Date || row.date;

    if (!Rating || String(Rating).trim() === '') {
      skippedNoRating.push({ title: Name, reason: 'No rating' });
      continue;
    }
    const rating = parseFloat(Rating);
    if (isNaN(rating) || rating < 1 || rating > 5) {
      skippedNoRating.push({ title: Name, reason: 'Invalid rating' });
      continue;
    }

    if (existingTitles.has(Name)) {
      duplicates.push({ title: Name, reason: 'Duplicate' });
      continue;
    }

    moviesToImport.push({
      title: Name,
      rating: rating * 2,
      date_watched: Date || null,
      type: 'movie',
      status: 'watched',
      notes: '',
      genre: '',
      director: '',
    });
  }

  return {
    totalInCSV: csvData.length,
    skippedNoRating: skippedNoRating.length,
    duplicates: duplicates.length,
    toImport: moviesToImport.length,
    preview: moviesToImport.slice(0, 5),
    allMovies: moviesToImport,
  };
}
