import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, User, Star, Calendar, Film, Tv, Mic } from 'lucide-react';
import { getFriendMovies } from '../api/friendsApi';
import { getSupabase } from '../utils/supabase';
import { FriendsProvider } from '../utils/FriendsContext';
import { CONTENT_TYPES, ACCENT } from '../utils/contentTypes';

const TAB_ICONS = { movie: Film, tv: Tv, podcast: Mic };

function formatDate(d) {
  if (!d) return 'No date';
  const [year, month, day] = d.split('-');
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function ReadOnlyCard({ item }) {
  return (
    <div className="glass rounded-xl p-4 border border-white/5">
      <div className="flex justify-between items-start mb-2 gap-2">
        <h3 className="text-lg font-bold text-white line-clamp-2">{item.title}</h3>
        {typeof item.rating === 'number' && (
          <div className="flex items-center gap-1 text-yellow-400 flex-shrink-0">
            <Star size={14} fill="currentColor" />
            <span className="font-bold text-sm">{item.rating}</span>
          </div>
        )}
      </div>
      {item.director && (
        <div className="text-white/60 text-xs mb-1">Director: {item.director}</div>
      )}
      {item.type === 'podcast' && item.host && (
        <div className="text-white/60 text-xs mb-1">Host: {item.host}</div>
      )}
      {item.type === 'tv' && (item.num_seasons || item.total_episodes) && (
        <div className="text-white/60 text-xs mb-1">
          {item.num_seasons ? `${item.num_seasons} season${item.num_seasons === 1 ? '' : 's'}` : ''}
          {item.num_seasons && item.total_episodes ? ' · ' : ''}
          {item.total_episodes ? `${item.total_episodes} episodes` : ''}
        </div>
      )}
      <div className="flex items-center gap-2 text-white/60 text-xs mt-2">
        <Calendar size={12} /> <span>{formatDate(item.date_watched)}</span>
        {item.genre && (
          <span className="ml-auto px-2 py-0.5 rounded-full bg-white/10 text-white/70">{item.genre}</span>
        )}
      </div>
      {item.notes && (
        <p className="text-white/60 text-xs mt-2 pt-2 border-t border-white/10 line-clamp-3">
          {item.notes}
        </p>
      )}
    </div>
  );
}

function FriendProfilePageInner() {
  const { friendId } = useParams();
  const [profile, setProfile] = useState(null);
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState('movie');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const sb = getSupabase();
        const { data: prof } = await sb
          .from('profiles')
          .select('id, username, display_name, bio, avatar_url')
          .eq('id', friendId)
          .maybeSingle();
        const rows = await getFriendMovies(friendId);
        if (cancelled) return;
        setProfile(prof || { id: friendId });
        setItems(rows);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [friendId]);

  // Grouped by explicit type. A `!== 'tv'` test here used to file podcasts
  // (and anything else new) under Movies.
  const byType = useMemo(() => {
    const groups = Object.fromEntries(Object.keys(CONTENT_TYPES).map((k) => [k, []]));
    for (const i of items) (groups[i.type] || groups.movie).push(i);
    return groups;
  }, [items]);
  const visible = byType[tab] || byType.movie;
  const name = profile?.display_name || (profile?.username ? `@${profile.username}` : 'Friend');

  return (
    <div className="min-h-screen bg-gradient-to-br from-bg-primary via-bg-secondary to-bg-primary">
      <div className="container mx-auto px-4 py-8 pb-32 max-w-5xl">
        <Link to="/friends" className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-4 text-sm">
          <ArrowLeft size={16} /> Back to friends
        </Link>

        <motion.header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 mb-6 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-neon-cyan/20 flex items-center justify-center text-neon-cyan flex-shrink-0">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <User size={28} />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-white truncate">{name}</h1>
            {profile?.username && profile?.display_name && (
              <div className="text-white/50 text-sm">@{profile.username}</div>
            )}
            {profile?.bio && <p className="text-white/70 text-sm mt-1">{profile.bio}</p>}
          </div>
        </motion.header>

        <div className="flex gap-2 mb-4 p-1 glass rounded-xl w-fit">
          {Object.values(CONTENT_TYPES).map((ct) => {
            const Icon = TAB_ICONS[ct.key];
            const a = ACCENT[ct.accent];
            return (
              <button
                key={ct.key}
                onClick={() => setTab(ct.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
                  tab === ct.key ? `${a.bgSoft} ${a.text}` : 'text-white/70 hover:text-white'
                }`}
              >
                <Icon size={16} /> {ct.nav} ({byType[ct.key].length})
              </button>
            );
          })}
        </div>

        {loading && <p className="text-white/50">Loading…</p>}
        {error && <p className="text-red-400">{error}</p>}

        {!loading && !error && (
          visible.length === 0 ? (
            <p className="text-white/50 text-sm text-center py-8">
              Nothing to show. {name} hasn't shared any {(CONTENT_TYPES[tab] || CONTENT_TYPES.movie).plural} publicly yet.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((i) => <ReadOnlyCard key={i.id} item={i} />)}
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default function FriendProfilePage() {
  return (
    <FriendsProvider>
      <FriendProfilePageInner />
    </FriendsProvider>
  );
}
