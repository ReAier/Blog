import { authApi } from './auth';
import { clipsApi } from './clips';
import { imagesApi } from './images';
import { operationsApi } from './operations';
import { postsApi } from './posts';

export { ApiConflictError, ApiError } from './transport';
export type { RequestOptions } from './transport';

export const api = {
  ...authApi,
  ...postsApi,
  ...clipsApi,
  ...imagesApi,
  ...operationsApi,
};
