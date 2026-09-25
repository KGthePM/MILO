import { IS_CLOUD } from '../utils/mode';

let bookApi;
if (IS_CLOUD) {
  const cloud = await import('./cloud');
  bookApi = cloud.bookApi;
} else {
  const local = await import('./bookApi.local');
  bookApi = local.bookApi;
}

export { bookApi };
