import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Plus, Check, Loader2 } from 'lucide-react';
import { parseAssistantReply } from '../../ai/assistantTags';
import { getContentType, accentFor, iconFor } from '../../utils/contentTypes';
import { lookupRecArtwork } from '../../api/artworkLookup';
import CoverArt from './CoverArt';

// One assistant bubble. Titles MILO tagged as recommendations glow in their
// type's accent inline; once the reply settles, a rail of those picks sits
// under the bubble with a one-tap add to the matching To Watch / To Listen /
// To Read list. Tapping an inline title brings its rail card into view.
//
// `pickState(pick)` → 'idle' | 'busy' | 'added' | 'onList' | 'done'
// `onTogglePick(pick, { artwork_url })` adds, or undoes a session add.
export default function AssistantReply({ message, pickState, onTogglePick }) {
  const streaming = message.streaming === true;
  const { segments, picks } = useMemo(
    () => parseAssistantReply(message.content, { streaming }),
    [message.content, streaming]
  );
  const reduceMotion = useReducedMotion();
  const tileRefs = useRef({});
  const [flashKey, setFlashKey] = useState(null);

  useEffect(() => {
    if (!flashKey) return undefined;
    const t = setTimeout(() => setFlashKey(null), 900);
    return () => clearTimeout(t);
  }, [flashKey]);

  const showRail = !streaming && picks.length > 0;

  const focusPick = (key) => {
    const el = tileRefs.current[key];
    if (!el) return;
    el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
    setFlashKey(key);
  };

  return (
    <div className="flex flex-col items-start gap-2 max-w-full">
      <div className="max-w-[85%] rounded-lg p-3 text-sm leading-relaxed whitespace-pre-wrap bg-white/5 border border-white/10 text-white/90">
        {segments.map((seg, i) => {
          if (seg.kind === 'text') return <span key={i}>{seg.value}</span>;
          const A = accentFor(seg.type);
          return showRail ? (
            <button
              key={i}
              type="button"
              onClick={() => focusPick(seg.key)}
              className={`inline font-semibold underline underline-offset-4 decoration-1 ${A.text} ${A.underline} hover:brightness-125 transition-[filter]`}
            >
              {seg.title}
            </button>
          ) : (
            <span key={i} className={`font-semibold ${A.text}`}>{seg.title}</span>
          );
        })}
      </div>

      {showRail && (
        <div className="w-full overflow-x-auto overscroll-x-contain -mx-1 px-1 pb-1">
          <div className="flex gap-2 w-max">
            {picks.map((pick, i) => (
              <motion.div
                key={pick.key}
                ref={(el) => { tileRefs.current[pick.key] = el; }}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: reduceMotion ? 0 : Math.min(i * 0.05, 0.1) }}
              >
                <PickCard
                  pick={pick}
                  state={pickState(pick)}
                  flashing={flashKey === pick.key}
                  onToggle={onTogglePick}
                />
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PickCard({ pick, state, flashing, onToggle }) {
  const [art, setArt] = useState(null);
  useEffect(() => {
    let live = true;
    lookupRecArtwork({ title: pick.title, year: pick.year }, pick.type).then((a) => {
      if (live && a) setArt(a);
    });
    return () => { live = false; };
  }, [pick.title, pick.year, pick.type]);

  const ct = getContentType(pick.type);
  const A = accentFor(pick.type);
  const Icon = iconFor(pick.type);
  const year = pick.year || art?.year || '';

  let label;
  let icon;
  let disabled = false;
  let tone = A.btnSmall;
  switch (state) {
    case 'busy':
      label = 'Adding';
      icon = <Loader2 size={13} className="animate-spin" />;
      disabled = true;
      break;
    case 'added':
      label = 'Added';
      icon = <Check size={13} />;
      tone = A.chipActive;
      break;
    case 'onList':
      label = 'On your list';
      icon = <Check size={13} />;
      disabled = true;
      tone = 'bg-white/5 border-white/10';
      break;
    case 'done':
      label = ct.verb;
      icon = <Check size={13} />;
      disabled = true;
      tone = 'bg-white/5 border-white/10';
      break;
    default:
      label = ct.verbTo;
      icon = <Plus size={13} />;
  }

  return (
    <div
      className={`w-56 flex gap-3 p-2 rounded-xl bg-white/[0.04] border transition-colors duration-300 ${flashing ? A.ring : 'border-white/10'}`}
    >
      <CoverArt contentType={pick.type} src={art?.artwork_url} title={pick.title} />
      <div className="min-w-0 flex-1 flex flex-col justify-between py-0.5">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white leading-snug line-clamp-2">{pick.title}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-white/50">
            <Icon size={11} className={A.iconSoft} />
            <span className="capitalize">{ct.singular}{year ? ` · ${year}` : ''}</span>
          </p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onToggle(pick, { artwork_url: art?.artwork_url || null })}
          title={state === 'added' ? 'Tap to take it off your list' : undefined}
          className={`mt-2 self-start inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors disabled:cursor-default ${tone} ${state === 'onList' || state === 'done' ? 'text-white/50' : A.text}`}
        >
          {icon}
          {label}
        </button>
      </div>
    </div>
  );
}
