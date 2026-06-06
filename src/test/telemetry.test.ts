import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initTelemetry, captureError, track, identifyUser } from '../telemetry';

describe('telemetry shim', () => {
  beforeEach(() => {
    delete (window as { __KIDO_TELEMETRY__?: unknown }).__KIDO_TELEMETRY__;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('captureError logs in dev without throwing on missing context', () => {
    expect(() => captureError(new Error('boom'))).not.toThrow();
    expect(() => captureError('a string error')).not.toThrow();
    expect(() => captureError(undefined)).not.toThrow();
  });

  it('track does not throw on missing props', () => {
    expect(() => track('user_signed_in')).not.toThrow();
    expect(() => track('booking_created', { id: 'B-001' })).not.toThrow();
  });

  it('identifyUser does not throw', () => {
    expect(() => identifyUser('user-123')).not.toThrow();
    expect(() => identifyUser('user-123', { role: 'admin' })).not.toThrow();
  });

  it('initTelemetry is idempotent (safe to call twice)', () => {
    initTelemetry({ environment: 'test' });
    initTelemetry({ environment: 'test' });
    expect((window as { __KIDO_TELEMETRY__?: { initialized: boolean } }).__KIDO_TELEMETRY__?.initialized).toBe(true);
  });
});
