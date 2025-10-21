export const APP_VERSION: string =
  (typeof process !== 'undefined' &&
    (process.env.NEXT_PUBLIC_APP_VERSION ||
      process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA)) ||
  'dev';

