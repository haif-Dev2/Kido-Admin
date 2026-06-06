import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { initTelemetry } from './telemetry';
// @ts-expect-error - migrated from JSX
import { Root } from './Root.jsx';
// @ts-expect-error - migrated from JSX
import { ErrorBoundary } from './ErrorBoundary.jsx';

// Wire error + analytics reporting before mounting the app, so any
// initialization error is captured.
initTelemetry({ environment: import.meta.env.MODE });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </StrictMode>,
);
