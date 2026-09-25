import { useEffect, useState } from 'react';
import { loadUserPrefs, subscribeUserPrefs } from '../../utils/userPrefs';

// Live view of the onboarding slice of user prefs. The reel, the hints and the
// Settings replay buttons all read through this so a change in one (dismiss,
// replay) reaches the others without a reload.
export default function useOnboarding() {
  const [onboarding, setOnboarding] = useState(() => loadUserPrefs().onboarding);
  useEffect(() => subscribeUserPrefs((prefs) => setOnboarding(prefs.onboarding)), []);
  return onboarding;
}
