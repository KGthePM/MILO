import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Settings as SettingsIcon, Sparkles, Palette, Database, User } from 'lucide-react';
import { FriendsProvider } from '../utils/FriendsContext';
import { IS_CLOUD } from '../utils/mode';
import { getSupabase } from '../utils/supabase';
import AIProvidersSection from '../components/settings/AIProvidersSection';
import AppearanceSection from '../components/settings/AppearanceSection';
import DataSection from '../components/settings/DataSection';
import ProfileEditor from '../components/friends/ProfileEditor';

const TABS = [
  ...(IS_CLOUD ? [{ id: 'profile', label: 'Profile', icon: User }] : []),
  { id: 'ai', label: 'AI providers', icon: Sparkles },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'data', label: 'Data', icon: Database },
];

function SettingsContent() {
  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const [session, setSession] = useState(null);

  useEffect(() => {
    if (!IS_CLOUD) return;
    let mounted = true;
    getSupabase().auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session);
    });
    const { data: sub } = getSupabase().auth.onAuthStateChange((_e, s) => {
      if (mounted) setSession(s);
    });
    return () => { mounted = false; sub.subscription?.unsubscribe(); };
  }, []);

  const handleSignOut = async () => {
    if (IS_CLOUD) await getSupabase().auth.signOut();
  };

  return (
    <div className="min-h-screen px-4 sm:px-8 py-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-2 px-3 py-2 rounded-lg glass text-white/70 hover:text-white hover:bg-white/10 transition-all"
          >
            <ArrowLeft size={18} /> Back
          </Link>
          <div className="flex items-center gap-2 ml-2">
            <SettingsIcon className="text-neon-cyan" size={26} />
            <h1 className="text-3xl font-bold neon-text-cyan">Settings</h1>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <nav className="md:w-56 shrink-0">
          <ul className="flex md:flex-col gap-2 overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <li key={tab.id}>
                  <button
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border transition-all whitespace-nowrap ${
                      active
                        ? 'bg-cyan-500/20 border-cyan-500/40 text-white'
                        : 'glass border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon size={16} />
                    <span className="text-sm font-medium">{tab.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex-1 min-w-0 glass rounded-2xl p-6 border border-white/10">
          {activeTab === 'profile' && IS_CLOUD && (
            <FriendsProvider>
              <ProfileEditor onSignOut={handleSignOut} />
            </FriendsProvider>
          )}
          {activeTab === 'ai' && <AIProvidersSection />}
          {activeTab === 'appearance' && <AppearanceSection />}
          {activeTab === 'data' && (
            <DataSection session={session} onSignOut={handleSignOut} />
          )}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return <SettingsContent />;
}
