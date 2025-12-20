import * as Sentry from "@sentry/nextjs";

const collectIntegrations = <T>(integrations: Array<T | undefined>): T[] =>
  integrations.filter((integration): integration is T => Boolean(integration));

export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

  if (!dsn) {
    return;
  }
  const release =
    process.env.NEXT_PUBLIC_SENTRY_RELEASE ||
    process.env.SENTRY_RELEASE ||
    process.env.NEXT_PUBLIC_APP_VERSION ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    undefined;

  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_APP_ENV || process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    release,
    tracesSampleRate: Number(
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"
    ),
    replaysSessionSampleRate: Number(
      process.env.NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE ?? "0"
    ),
    replaysOnErrorSampleRate: Number(
      process.env.NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE ?? "1"
    ),
    integrations: collectIntegrations([
      typeof Sentry.browserTracingIntegration === "function"
        ? Sentry.browserTracingIntegration()
        : undefined,
      typeof Sentry.replayIntegration === "function"
        ? Sentry.replayIntegration({
            maskAllInputs: false,
            blockAllMedia: false,
          })
        : undefined,
    ]),
  });
}
