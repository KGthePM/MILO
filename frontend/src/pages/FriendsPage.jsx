import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, UserPlus, Inbox, Film, UserCircle } from 'lucide-react';
import { useFriends } from '../utils/FriendsContext';
import { FriendsProvider } from '../utils/FriendsContext';
import FriendCard from '../components/friends/FriendCard';
import FriendRequestCard from '../components/friends/FriendRequestCard';
import AddFriendModal from '../components/friends/AddFriendModal';
import ProfileEditor from '../components/friends/ProfileEditor';
import EmptyState from '../components/shared/EmptyState';

function FriendsPageInner() {
  const { friends, incoming, outgoing, loading, error } = useFriends();
  const [tab, setTab] = useState('friends');
  const [showAdd, setShowAdd] = useState(false);

  const tabs = [
    { id: 'friends', label: `Friends${friends.length ? ` (${friends.length})` : ''}`, icon: Users },
    { id: 'requests', label: `Requests${incoming.length ? ` (${incoming.length})` : ''}`, icon: Inbox },
    { id: 'profile', label: 'Profile', icon: UserCircle },
  ];

  return (
    <div className="min-h-screen safe-area bg-gradient-to-br from-bg-primary via-bg-secondary to-bg-primary">
      <div className="container mx-auto px-4 py-8 pb-32 max-w-3xl">
        <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Users className="text-neon-cyan" size={28} />
              <span className="neon-text-cyan">Friends</span>
            </h1>
            <div className="flex items-center gap-2">
              <Link
                to="/movies"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white/70 hover:text-white hover:bg-white/20 font-semibold"
              >
                <Film size={16} /> Home
              </Link>
              <button
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-neon-cyan/20 border border-neon-cyan/50 text-neon-cyan font-semibold hover:bg-neon-cyan/30"
              >
                <UserPlus size={16} /> Add friend
              </button>
            </div>
          </div>
          <p className="text-white/60 text-sm mt-2">
            See what your friends are watching. Items you mark private stay hidden.
          </p>
        </motion.header>

        <div className="flex gap-2 mb-6 p-1 glass rounded-xl">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  active ? 'bg-neon-cyan/20 text-neon-cyan neon-border-cyan' : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={16} /> <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {error && <div className="text-red-400 mb-4 text-sm">{error}</div>}
        {loading && <div className="text-white/50 text-sm">Loading…</div>}

        {tab === 'friends' && (
          <div className="space-y-3">
            {friends.length === 0 ? (
              <EmptyState
                accent="magenta"
                icon={Users}
                title="No one here yet"
                body="Add a friend and you can see what they're watching \u2014 and they can see you."
                actionLabel="Add a friend"
                showGhosts={false}
                onAction={() => setShowAdd(true)}
              />
            ) : (
              friends.map((f) => <FriendCard key={f.friendshipId} friend={f} />)
            )}
          </div>
        )}

        {tab === 'requests' && (
          <div className="space-y-6">
            <section>
              <h2 className="text-white/70 text-sm font-semibold mb-2">Incoming</h2>
              {incoming.length === 0 ? (
                <p className="text-white/40 text-sm">No incoming requests.</p>
              ) : (
                <div className="space-y-2">
                  {incoming.map((r) => (
                    <FriendRequestCard key={r.id} request={r} direction="incoming" />
                  ))}
                </div>
              )}
            </section>
            <section>
              <h2 className="text-white/70 text-sm font-semibold mb-2">Sent</h2>
              {outgoing.length === 0 ? (
                <p className="text-white/40 text-sm">No outgoing requests.</p>
              ) : (
                <div className="space-y-2">
                  {outgoing.map((r) => (
                    <FriendRequestCard key={r.id} request={r} direction="outgoing" />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {tab === 'profile' && <ProfileEditor />}
      </div>

      <AddFriendModal isOpen={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  );
}

export default function FriendsPage() {
  return (
    <FriendsProvider>
      <FriendsPageInner />
    </FriendsProvider>
  );
}
