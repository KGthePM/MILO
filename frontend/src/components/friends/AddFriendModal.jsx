import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Search, UserPlus, User } from 'lucide-react';
import { useFriends } from '../../utils/FriendsContext';

export default function AddFriendModal({ isOpen, onClose }) {
  const { searchUsers, sendRequest } = useFriends();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sentTo, setSentTo] = useState(new Set());

  if (!isOpen) return null;

  const onSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const found = await searchUsers(query);
      setResults(found);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const onSend = async (userId) => {
    try {
      await sendRequest(userId);
      setSentTo(new Set([...sentTo, userId]));
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="glass rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto neon-border-cyan"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold neon-text-cyan">Add Friend</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={onSearch} className="flex gap-2 mb-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="email or @username"
            className="flex-1 px-4 py-3 rounded-lg glass"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-4 py-3 rounded-lg bg-neon-cyan/20 border border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/30 disabled:opacity-50"
          >
            <Search size={18} />
          </button>
        </form>

        {error && <p className="text-red-400 text-sm mb-2">{error}</p>}

        <div className="space-y-2">
          {!loading && results.length === 0 && query && (
            <p className="text-white/50 text-sm text-center py-4">No users found.</p>
          )}
          {results.map((u) => {
            const name = u.display_name || (u.username ? `@${u.username}` : u.id);
            const sent = sentTo.has(u.id);
            return (
              <div key={u.id} className="glass rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <User size={16} className="text-white/60" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-white text-sm truncate">{name}</div>
                    {u.username && u.display_name && (
                      <div className="text-white/40 text-xs truncate">@{u.username}</div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onSend(u.id)}
                  disabled={sent}
                  className="px-3 py-1.5 rounded-lg bg-neon-cyan/20 text-neon-cyan text-sm hover:bg-neon-cyan/30 disabled:opacity-50 flex items-center gap-1"
                >
                  {sent ? 'Sent' : (<><UserPlus size={14} /> Add</>)}
                </button>
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}
