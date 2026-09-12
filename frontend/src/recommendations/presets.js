// Quick Hitters — one-click preset "mood" scenarios for Smart Recs.
//
// A selected preset travels as the recommendation `type` value (URL-safe id), so
// it flows through the existing recommendation pipeline (route loop + cache key)
// with no new query param. The prompt builders (frontend/src/ai/prompt.js and
// backend/ollama-recommender.js) recognize a preset id via isPresetId() and append
// its `directive` to the taste signal.
//
// Each preset is scoped via `contentTypes` to the content types it makes sense
// for; EnhancedRecommendations.jsx only renders matching chips. Movies/TV keep
// viewing-mood presets; podcasts get listening-genre presets, since podcast recs
// are interest-driven ("true crime", "comedy") rather than occasion-driven
// ("date night").
//
// IMPORTANT: the id→directive map is mirrored in backend/ollama-recommender.js
// (PRESET_DIRECTIVES) because the CommonJS backend can't import this ESM module.
// Keep the directive text in sync across both files.

export const PRESETS = [
  // ── Movies & TV ──────────────────────────────────────────────────────────
  {
    id: 'rainy_day',
    contentTypes: ['movie', 'tv'],
    label: 'Rainy Day Comfort',
    emoji: '🌧️',
    directive:
      'Right now I want cozy, immersive comfort viewing — the kind of bad-weather escapism you sink into under a blanket. Favor warm, absorbing, low-stress picks over anything abrasive or exhausting.',
  },
  {
    id: 'feel_good',
    contentTypes: ['movie', 'tv'],
    label: 'Feel-Good Fix',
    emoji: '😊',
    directive:
      'Right now I want an uplifting, feel-good watch — warm, satisfying, and hopeful, with an ending that leaves me better than it found me. Steer away from bleak or downer material.',
  },
  {
    id: 'dark_heavy',
    contentTypes: ['movie', 'tv'],
    label: 'Dark & Heavy',
    emoji: '🌑',
    directive:
      'Right now I want something dark and heavy — intense, psychologically weighty, and lingering long after it ends. Lean into discomfort and moral murk; avoid light or breezy picks.',
  },
  {
    id: 'mind_melts',
    contentTypes: ['movie', 'tv'],
    label: 'Mind Melts',
    emoji: '🌀',
    directive:
      'Right now I want a mind-melter — twisty, puzzle-box, thought-provoking work that rewards close attention and keeps me thinking. Favor ambiguity and clever structure over the straightforward.',
  },
  {
    id: 'date_night',
    contentTypes: ['movie', 'tv'],
    label: 'Date Night',
    emoji: '❤️',
    directive:
      'Right now I want a date-night pick — broadly appealing, well-paced, and conversation-worthy for two people, without being niche or alienating. Balance quality with easy enjoyment.',
  },
  {
    id: 'group_watch',
    contentTypes: ['movie', 'tv'],
    label: 'Group Watch',
    emoji: '🍿',
    directive:
      'Right now I want a crowd-pleaser for a group — low-friction, broadly accessible, and fun to watch together, nothing that demands total silence or divides the room.',
  },
  {
    id: 'short_sweet',
    contentTypes: ['movie', 'tv'],
    label: 'Short & Sweet',
    emoji: '⏱️',
    directive:
      'Right now I want something short and sweet — low time commitment (ideally around 100 minutes or under for films, or tight/bingeable for series), punchy and economical, no sprawling epics.',
  },
  {
    id: 'cult_polarizing',
    contentTypes: ['movie', 'tv'],
    label: 'Cult & Polarizing',
    emoji: '⚡',
    directive:
      'Right now I want something divisive and cult — love-it-or-hate-it, boundary-pushing work with a devoted following. It is fine to stretch beyond my usual comfort zone and recommend polarizing picks.',
  },

  // ── Podcasts — listening is genre/interest-driven, not occasion-driven ───
  {
    id: 'true_crime',
    contentTypes: ['podcast'],
    label: 'True Crime',
    emoji: '🔎',
    directive:
      'Right now I want gripping true crime — meticulous investigation, chilling real cases, and storytelling that stays with me. Keep it compelling and well-researched, not gratuitous.',
  },
  {
    id: 'make_me_laugh',
    contentTypes: ['podcast'],
    label: 'Make Me Laugh',
    emoji: '😂',
    directive:
      'Right now I want podcasts that make me laugh — sharp, genuinely funny comedy from hosts with great chemistry and timing. Light and hilarious over heavy or grim.',
  },
  {
    id: 'learn_something',
    contentTypes: ['podcast'],
    label: 'Learn Something',
    emoji: '🧪',
    directive:
      'Right now I want to learn something — smart, curious podcasts about science, STEM, history, or big ideas, explained clearly and engagingly. Favor rigorous, well-produced shows that make complicated subjects feel approachable.',
  },
  {
    id: 'deep_dive',
    contentTypes: ['podcast'],
    label: 'Deep Dive',
    emoji: '🎙️',
    directive:
      'Right now I want a deep dive — serialized narrative storytelling and investigative journalism with strong pacing and a story that pulls me from episode to episode. Immersive and bingeable.',
  },
  {
    id: 'comfort_listen',
    contentTypes: ['podcast'],
    label: 'Comfort Listen',
    emoji: '☕',
    directive:
      'Right now I want a comfort listen — warm, companionable shows that feel like time with a good friend: low-stakes, easy to drift along with, and never exhausting.',
  },
  {
    id: 'quick_hits',
    contentTypes: ['podcast'],
    label: 'Quick Hits',
    emoji: '⏱️',
    directive:
      'Right now I want quick hits — episodic podcasts that fit a commute, roughly 45 minutes or under per episode, satisfying without a huge episode backlog or a long serialized commitment.',
  },
  {
    id: 'blow_my_mind',
    contentTypes: ['podcast'],
    label: 'Blow My Mind',
    emoji: '🌀',
    directive:
      'Right now I want a mind-bender — podcasts that upend how I see things: big ideas, strange frontiers, and perspective-shifting conversations that keep me thinking long after the episode ends.',
  },
];

const BY_ID = new Map(PRESETS.map((p) => [p.id, p]));

export function isPresetId(id) {
  return typeof id === 'string' && BY_ID.has(id);
}

export function getPresetDirective(id) {
  return BY_ID.get(id)?.directive || '';
}
