/**
 * Lightweight error + analytics wiring.
 *
 * Currently a no-op shim — call `initTelemetry()` once at startup and use
 * `captureError(e)` / `track(event)` everywhere. When you're ready to wire a
 * real backend (Sentry, PostHog, Plausible), the integration is one place:
 * fill in this file.
 *
 * Why ship the shim now? So that every async/error path already calls into a
 * consistent reporting surface. Adding the real backend later is a 10-line
 * change here, not a 200-line audit across every page.
 */

declare global {
  interface Window {
    __KIDO_TELEMETRY__?: { initialized: boolean };
  }
}

interface TelemetryConfig {
  /** Sentry DSN — when set, errors are forwarded. Optional. */
  sentryDsn?: string;
  /** PostHog key — when set, events are forwarded. Optional. */
  posthogKey?: string;
  /** Environment label, e.g. 'production' / 'preview' / 'dev'. */
  environment?: string;
}

// Expose the current config via getter so a) it's queryable from telemetry
// reporters added later, and b) TypeScript doesn't complain about an
// unused variable (the future Sentry/PostHog wiring will read this).
let currentConfig: TelemetryConfig = {};
export const getTelemetryConfig = (): Readonly<TelemetryConfig> => currentConfig;

export function initTelemetry(cfg: TelemetryConfig = {}) {
  if (typeof window !== 'undefined' && window.__KIDO_TELEMETRY__?.initialized) return;
  currentConfig = cfg;
  if (typeof window !== 'undefined') {
    window.__KIDO_TELEMETRY__ = { initialized: true };

    // Catch any unhandled error / rejection that escaped React's boundary.
    window.addEventListener('error', (e) => captureError(e.error ?? new Error(e.message)));
    window.addEventListener('unhandledrejection', (e) => captureError(e.reason));
  }

  // When Sentry is wired:
  // if (currentConfig.sentryDsn) {
  //   const Sentry = await import('@sentry/browser');
  //   Sentry.init({ dsn: currentConfig.sentryDsn, environment: currentConfig.environment });
  // }
}

/** Report an error with context. Safe to call before initTelemetry. */
export function captureError(error: unknown, context?: Record<string, unknown>) {
  // Always log to console in dev; in prod the surface is the real backend.
  if (import.meta.env.DEV) {
    console.error('[telemetry]', error, context);
  }
  // When Sentry is wired: Sentry.captureException(error, { extra: context });
}

/** Track an analytics event. Safe to call before initTelemetry. */
export function track(event: string, props?: Record<string, unknown>) {
  if (import.meta.env.DEV) {
    console.log('[telemetry] track:', event, props);
  }
  // When PostHog is wired: posthog.capture(event, props);
}

/** Attach the current user to all subsequent reports. */
export function identifyUser(userId: string, traits?: Record<string, unknown>) {
  if (import.meta.env.DEV) {
    console.log('[telemetry] identify:', userId, traits);
  }
  // When wired: Sentry.setUser({ id: userId }); posthog.identify(userId, traits);
}
