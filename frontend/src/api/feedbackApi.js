import { IS_CLOUD } from '../utils/mode';

let api;
if (IS_CLOUD) {
  const cloud = await import('./cloud');
  api = cloud.feedbackApi;
} else {
  const local = await import('./feedbackApi.local');
  api = local.api;
}

export { api };
