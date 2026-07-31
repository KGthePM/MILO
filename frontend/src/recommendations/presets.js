// Quick Hitters — one-click preset "mood" scenarios for Smart Recs.
//
// A selected preset travels as the recommendation `type` value (URL-safe id), so
// it flows through the existing recommendation pipeline (route loop + cache key)
// with no new query param. The prompt builders (frontend/src/ai/prompt.js and
// backend/ollama-recommender.js) recognize a preset id via isPresetId() and append
// its `directive` to the taste signal.
//
// IMPORTANT: the id→directive map is mirrored in backend/ollama-recommender.js
// (PRESET_DIRECTIVES) because the CommonJS backend can't import this ESM module.
// Keep the directive text in sync across both files.

export const PRESETS = [
  {
    id: 'rainy_day',
    label: 'Rainy Day Comfort',
    emoji: '🌧️',
    directive:
      'Right now I want cozy, immersive comfort viewing — the kind of bad-weather escapism you sink into under a blanket. Favor warm, absorbing, low-stress picks over anything abrasive or exhausting.',
  },
  {
    id: 'feel_good',
    label: 'Feel-Good Fix',
    emoji: '😊',
    directive:
      'Right now I want an uplifting, feel-good watch — warm, satisfying, and hopeful, with an ending that leaves me better than it found me. Steer away from bleak or downer material.',
  },
  {
    id: 'dark_heavy',
    label: 'Dark & Heavy',
    emoji: '🌑',
    directive:
      'Right now I want something dark and heavy — intense, psychologically weighty, and lingering long after it ends. Lean into discomfort and moral murk; avoid light or breezy picks.',
  },
  {
    id: 'mind_melts',
    label: 'Mind Melts',
    emoji: '🌀',
    directive:
      'Right now I want a mind-melter — twisty, puzzle-box, thought-provoking work that rewards close attention and keeps me thinking. Favor ambiguity and clever structure over the straightforward.',
  },
  {
    id: 'date_night',
    label: 'Date Night',
    emoji: '❤️',
    directive:
      'Right now I want a date-night pick — broadly appealing, well-paced, and conversation-worthy for two people, without being niche or alienating. Balance quality with easy enjoyment.',
  },
  {
    id: 'group_watch',
    label: 'Group Watch',
    emoji: '🍿',
    directive:
      'Right now I want a crowd-pleaser for a group — low-friction, broadly accessible, and fun to watch together, nothing that demands total silence or divides the room.',
  },
  {
    id: 'short_sweet',
    label: 'Short & Sweet',
    emoji: '⏱️',
    directive:
      'Right now I want something short and sweet — low time commitment (ideally around 100 minutes or under for films, or tight/bingeable for series), punchy and economical, no sprawling epics.',
  },
  {
    id: 'cult_polarizing',
    label: 'Cult & Polarizing',
    emoji: '⚡',
    directive:
      'Right now I want something divisive and cult — love-it-or-hate-it, boundary-pushing work with a devoted following. It is fine to stretch beyond my usual comfort zone and recommend polarizing picks.',
  },
];

const BY_ID = new Map(PRESETS.map((p) => [p.id, p]));

export function isPresetId(id) {
  return typeof id === 'string' && BY_ID.has(id);
}

export function getPresetDirective(id) {
  return BY_ID.get(id)?.directive || '';
}
