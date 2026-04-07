import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: "production",
  tracesSampleRate: 1.0,
  sendDefaultPii: true,
  integrations: [
    Sentry.vercelAIIntegration(),
    Sentry.httpIntegration(),
  ],
});
