// Taste insights behind the Stats row's third tile. Pure functions over the
// user's *watched* rows — both API backends attach the result to analytics as
// `insights`, so the tile never sees page filters (a genre filter would
// otherwise crown the filtered genre as your "signature").
//
// Each insight is { id, label, value, caption } or absent when the library
// can't support it yet. `value` is display-ready text.

// Ratings are shrunk toward the user's own average by this many phantom
// titles, so one 10/10 doesn't outrank twenty 8s.
const SHRINK = 3;
const RECENT_DAYS = 90;

const fmt1 = (n) => (Math.round(n * 10) / 10).toFixed(1);
const signed = (n) => `${n >= 0 ? '+' : '−'}${fmt1(Math.abs(n))}`;
const plural = (n, one, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

function groupBy(rows, keyFn) {
  const groups = new Map();
  rows.forEach((r) => {
    const key = keyFn(r);
    if (!key) return;
    const g = groups.get(key) || { key, n: 0, sum: 0, rated: 0 };
    g.n += 1;
    if (typeof r.rating === 'number') {
      g.sum += r.rating;
      g.rated += 1;
    }
    groups.set(key, g);
  });
  return [...groups.values()];
}

function withScores(groups, overall) {
  return groups.map((g) => ({
    ...g,
    avg: g.rated ? g.sum / g.rated : null,
    shrunk: (g.sum + SHRINK * overall) / (g.rated + SHRINK),
  }));
}

function rowDate(r) {
  const d = new Date(r.date_watched || r.created_at);
  return Number.isNaN(d.getTime()) ? null : d;
}

const trimText = (v) => (typeof v === 'string' ? v.trim() : v);

export function computeInsights(rows, contentType = 'movie') {
  const watched = (rows || []).filter((r) => (r.status || 'watched') === 'watched');
  const total = watched.length;
  if (!total) return {};

  const ratings = watched.map((r) => r.rating).filter((r) => typeof r === 'number');
  const overall = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
  const genres = withScores(groupBy(watched, (r) => trimText(r.genre)), overall);
  // Small libraries can't support a 3-title minimum without leaving every
  // tile blank, so the bar scales with the library.
  const minN = total >= 15 ? 3 : 2;
  const out = {};

  const byCount = [...genres].sort((a, b) => b.n - a.n || b.shrunk - a.shrunk);
  if (byCount[0]) {
    const top = byCount[0];
    out.mostLogged = {
      id: 'mostLogged',
      label: 'Most Logged',
      value: top.key,
      caption: `${plural(top.n, 'title')} · ${Math.round((top.n / total) * 100)}% of the mix`,
    };
  }

  const eligible = genres.filter((g) => g.rated >= minN);
  const byLift = [...eligible].sort((a, b) => b.shrunk - a.shrunk);
  const signature = byLift[0] && byLift[0].avg > overall ? byLift[0] : null;
  if (signature) {
    out.signature = {
      id: 'signature',
      label: 'Signature Genre',
      value: signature.key,
      caption: `${fmt1(signature.avg)} avg · ${signed(signature.avg - overall)} over your usual`,
    };
  }

  // A genre you barely touch but rate well above your norm. Shrinkage is
  // deliberately skipped here — the point is the small sample.
  const gemCap = Math.max(2, Math.floor(total * 0.15));
  const gem = genres
    .filter((g) => g.rated >= 2 && g.n <= gemCap && g.key !== signature?.key && g.avg >= overall + 0.75)
    .sort((a, b) => b.avg - a.avg || a.n - b.n)[0];
  if (gem) {
    out.hiddenGem = {
      id: 'hiddenGem',
      label: 'Hidden Gem',
      value: gem.key,
      caption: `Only ${gem.n} logged, but ${fmt1(gem.avg)} avg`,
    };
  }

  const tough = byLift[byLift.length - 1];
  if (tough && byLift.length > 1 && tough.avg <= overall - 0.5) {
    out.toughest = {
      id: 'toughest',
      label: 'Toughest Crowd',
      value: tough.key,
      caption: `${fmt1(tough.avg)} avg · ${signed(tough.avg - overall)} under your usual`,
    };
  }

  // The genre whose share of the last 90 days most outpaces its share before.
  const cutoff = Date.now() - RECENT_DAYS * 86400000;
  const recent = [];
  const before = [];
  watched.forEach((r) => {
    const d = rowDate(r);
    if (d) (d.getTime() >= cutoff ? recent : before).push(r);
  });
  if (recent.length >= 3) {
    const priorShare = new Map(groupBy(before, (r) => trimText(r.genre)).map((g) => [g.key, g.n / (before.length || 1)]));
    const kick = groupBy(recent, (r) => trimText(r.genre))
      .filter((g) => g.n >= 2)
      .map((g) => ({ ...g, delta: g.n / recent.length - (priorShare.get(g.key) || 0) }))
      .sort((a, b) => b.delta - a.delta || b.n - a.n)[0];
    if (kick && kick.delta > 0) {
      out.onAKick = {
        id: 'onAKick',
        label: 'On a Kick',
        value: kick.key,
        caption: kick.n === recent.length
          ? `All ${kick.n} logged in the last ${RECENT_DAYS} days`
          : `${kick.n} of your last ${recent.length} in ${RECENT_DAYS} days`,
      };
    }
  }

  if (genres.length >= 2 && byCount[0]) {
    out.range = {
      id: 'range',
      label: 'Range',
      value: plural(genres.length, 'genre'),
      caption: `explored across ${plural(total, 'title')}`,
    };
  }

  Object.assign(out, typeSpecific(watched, contentType, overall));
  return out;
}

// The most-logged person (director / host / author) with at least two titles.
function goTo(rows, field, overall, { id, label, noun }) {
  const top = withScores(groupBy(rows, (r) => trimText(r[field])), overall)
    .filter((g) => g.n >= 2)
    .sort((a, b) => b.n - a.n || b.shrunk - a.shrunk)[0];
  if (!top) return null;
  const avg = top.avg != null ? ` · ${fmt1(top.avg)} avg` : '';
  return { id, label, value: top.key, caption: `${plural(top.n, noun)}${avg}` };
}

function favoriteDecade(rows, overall) {
  const decades = withScores(
    groupBy(rows, (r) => {
      const y = Number(r.release_year);
      return y >= 1880 && y <= 2100 ? `${Math.floor(y / 10) * 10}s` : null;
    }),
    overall,
  ).filter((g) => g.rated >= 2);
  if (decades.length < 2) return null;
  const best = decades.sort((a, b) => b.shrunk - a.shrunk)[0];
  return {
    id: 'decade',
    label: 'Favorite Decade',
    value: best.key,
    caption: `${fmt1(best.avg)} avg across ${best.n}`,
  };
}

const sumField = (rows, field) =>
  rows.reduce((acc, r) => acc + (Number(r[field]) > 0 ? Number(r[field]) : 0), 0);

function typeSpecific(rows, contentType, overall) {
  const out = {};
  const add = (insight) => {
    if (insight) out[insight.id] = insight;
  };

  if (contentType === 'movie') {
    add(goTo(rows, 'director', overall, { id: 'person', label: 'Go-to Director', noun: 'film' }));
    add(favoriteDecade(rows, overall));
  } else if (contentType === 'tv') {
    const seasons = sumField(rows, 'num_seasons');
    const episodes = sumField(rows, 'total_episodes');
    if (seasons > 0) {
      add({
        id: 'volume',
        label: 'Seasons Sunk In',
        value: seasons.toLocaleString(),
        caption: episodes > 0 ? `${plural(episodes, 'episode')} and counting` : 'across every show you finished',
      });
    }
    add(favoriteDecade(rows, overall));
  } else if (contentType === 'podcast') {
    add(goTo(rows, 'host', overall, { id: 'person', label: 'Go-to Host', noun: 'show' }));
    const heard = sumField(rows, 'episodes_heard');
    if (heard > 0) {
      add({ id: 'volume', label: 'Episodes Heard', value: heard.toLocaleString(), caption: `across ${plural(rows.length, 'show')}` });
    }
  } else if (contentType === 'book') {
    add(goTo(rows, 'author', overall, { id: 'person', label: 'Go-to Author', noun: 'book' }));
    // A finished book counts in full; pages_read only stands in when the
    // page count was never filled.
    const pages = rows.reduce((acc, r) => acc + (Number(r.page_count) > 0 ? Number(r.page_count) : Number(r.pages_read) > 0 ? Number(r.pages_read) : 0), 0);
    if (pages > 0) {
      add({ id: 'volume', label: 'Pages Read', value: pages.toLocaleString(), caption: `across ${plural(rows.length, 'book')}` });
    }
  }
  return out;
}

// Display order inside the expanded panel.
export const INSIGHT_ORDER = ['signature', 'mostLogged', 'hiddenGem', 'onAKick', 'toughest', 'person', 'decade', 'volume', 'range'];

export const DEFAULT_HEADLINE = 'signature';

// The tile's headline: the pinned insight if it still exists, else Signature,
// else Most Logged (always present once anything has a genre).
export function pickHeadline(insights, pinnedId) {
  if (!insights) return null;
  return insights[pinnedId] || insights[DEFAULT_HEADLINE] || insights.mostLogged || null;
}
