import { IS_CLOUD } from '../utils/mode';

let podcastApi;
if (IS_CLOUD) {
  const cloud = await import('./cloud');
  podcastApi = cloud.podcastApi;
} else {
  const local = await import('./podcastApi.local');
  podcastApi = local.podcastApi;
}

export { podcastApi };
