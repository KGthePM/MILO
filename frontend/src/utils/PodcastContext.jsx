import { useState, useEffect, createContext, useContext } from 'react';
import { podcastApi } from '../api/podcastApi';

export const PodcastContext = createContext();

export const PodcastProvider = ({ children }) => {
  const [podcasts, setPodcasts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPodcasts = async (params = {}) => {
    try {
      setLoading(true);

      const cleanParams = Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== undefined)
      );

      const data = await podcastApi.getPodcasts(cleanParams);
      setPodcasts(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const data = await podcastApi.getAnalytics();
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to fetch podcast analytics:', err);
    }
  };

  const addPodcast = async (podcast, defaultStatus = 'watched') => {
    await podcastApi.addPodcast({ ...podcast, status: podcast.status || defaultStatus });
    await fetchPodcasts();
    await fetchAnalytics();
  };

  const updatePodcast = async (id, podcast) => {
    await podcastApi.updatePodcast(id, podcast);
    await fetchPodcasts();
    await fetchAnalytics();
  };

  const updatePodcastStatus = async (id, status) => {
    const p = podcasts.find((x) => x.id === id);
    if (!p) return;
    await updatePodcast(id, { ...p, status });
  };

  const deletePodcast = async (id) => {
    await podcastApi.deletePodcast(id);
    await fetchPodcasts();
    await fetchAnalytics();
  };

  useEffect(() => {
    fetchPodcasts();
    fetchAnalytics();
  }, []);

  return (
    <PodcastContext.Provider value={{
      podcasts,
      analytics,
      loading,
      error,
      fetchPodcasts,
      addPodcast,
      updatePodcast,
      updatePodcastStatus,
      deletePodcast,
    }}>
      {children}
    </PodcastContext.Provider>
  );
};

export const usePodcasts = () => {
  const context = useContext(PodcastContext);
  if (!context) {
    throw new Error('usePodcasts must be used within a PodcastProvider');
  }
  return context;
};
