import React from 'react';
import { captureError } from './telemetry';

/**
 * Catches render errors anywhere in the React tree below it and shows a
 * fallback UI instead of crashing the entire admin shell.
 *
 * Class component because hooks have no equivalent of `componentDidCatch`.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Forward to the central telemetry surface. In dev this prints to console;
    // in prod (once a real Sentry DSN is set) it goes to the error tracker.
    captureError(error, { componentStack: info?.componentStack });
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    const message = this.state.error?.message ?? String(this.state.error);

    return (
      <div role="alert" style={{
        minHeight: '100vh', background: '#F1F3F8',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}>
        <div style={{
          width: '100%', maxWidth: 480,
          background: '#fff', borderRadius: 16,
          padding: 32, textAlign: 'center',
          boxShadow: '0 8px 24px rgba(14,20,32,0.08)',
          border: '1px solid #EDEFF4',
        }}>
          <div style={{
            width: 56, height: 56, margin: '0 auto 16px',
            background: '#FFE0E4', color: '#C8324A',
            borderRadius: 14, display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 26, fontWeight: 800,
          }}>!</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#0E1420' }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 13, color: '#6B7488', marginTop: 6, marginBottom: 20 }}>
            The admin console hit an unexpected error. Try reloading; if the
            problem persists, check the browser console.
          </div>
          {import.meta.env.DEV && (
            <pre style={{
              textAlign: 'left', fontSize: 11, color: '#C8324A',
              background: '#FFF5F6', border: '1px solid #FFE0E4',
              borderRadius: 8, padding: 12, overflow: 'auto', maxHeight: 200,
              fontFamily: 'ui-monospace, monospace',
            }}>{message}</pre>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
            <button onClick={this.reset} style={btnStyle('#0D7377', '#fff')}>
              Try again
            </button>
            <button onClick={() => location.reload()} style={btnStyle('#F1F3F8', '#2E3748')}>
              Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }
}

function btnStyle(bg, fg) {
  return {
    height: 40, padding: '0 18px', borderRadius: 10,
    background: bg, color: fg,
    border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: 700,
    fontFamily: 'inherit',
  };
}
