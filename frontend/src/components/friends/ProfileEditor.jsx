import { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { useFriends } from '../../utils/FriendsContext';

export default function ProfileEditor({ onSignOut }) {
  const { myProfile, updateProfile } = useFriends();
  const [form, setForm] = useState({ username: '', display_name: '', bio: '' });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (myProfile) {
      setForm({
        username: myProfile.username || '',
        display_name: myProfile.display_name || '',
        bio: myProfile.bio || '',
      });
    }
  }, [myProfile]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      await updateProfile(form);
      setStatus({ ok: true, msg: 'Profile saved.' });
    } catch (err) {
      setStatus({ ok: false, msg: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="glass rounded-2xl p-5 space-y-4">
      <h3 className="text-lg font-bold neon-text-cyan">Your profile</h3>
      <p className="text-white/50 text-sm">Pick a username so friends can find you.</p>

      <div>
        <label className="block text-sm mb-1 text-white/70">Username</label>
        <input
          type="text"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
          className="w-full px-4 py-2 rounded-lg glass"
          placeholder="e.g. milo_fan"
          maxLength={32}
        />
      </div>
      <div>
        <label className="block text-sm mb-1 text-white/70">Display name</label>
        <input
          type="text"
          value={form.display_name}
          onChange={(e) => setForm({ ...form, display_name: e.target.value })}
          className="w-full px-4 py-2 rounded-lg glass"
          maxLength={60}
        />
      </div>
      <div>
        <label className="block text-sm mb-1 text-white/70">Bio</label>
        <textarea
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
          className="w-full px-4 py-2 rounded-lg glass min-h-[80px]"
          maxLength={240}
        />
      </div>

      {status && (
        <p className={`text-sm ${status.ok ? 'text-neon-cyan' : 'text-red-400'}`}>{status.msg}</p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full py-2 px-4 rounded-lg bg-neon-cyan/20 border border-neon-cyan/50 text-neon-cyan font-semibold hover:bg-neon-cyan/30 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save profile'}
      </button>

      {onSignOut && (
        <button
          type="button"
          onClick={onSignOut}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-black/30 border border-white/10 text-white/70 hover:text-white hover:bg-white/10"
        >
          <LogOut size={16} /> Sign out
        </button>
      )}
    </form>
  );
}
