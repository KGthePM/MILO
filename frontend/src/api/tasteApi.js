import { IS_CLOUD } from '../utils/mode';

let api;
if (IS_CLOUD) {
  const cloud = await import('./cloud');
  api = cloud.tasteApi;
} else {
  const local = await import('./tasteApi.local');
  api = local.api;
}

export { api };
