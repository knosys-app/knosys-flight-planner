import type { ReactNode } from 'react';
import type { SharedDependencies } from '../types';

/**
 * Boundary around the plugin tree so runtime errors don't collapse into
 * a white screen. Logs via console.error and renders the stack so we can
 * triage without needing DevTools open.
 */
export function createPluginErrorBoundary(Shared: SharedDependencies) {
  const { React } = Shared;

  class PluginErrorBoundary extends React.Component<
    { children: ReactNode },
    { error: Error | null }
  > {
    constructor(props: { children: ReactNode }) {
      super(props);
      this.state = { error: null };
    }

    static getDerivedStateFromError(error: Error) {
      return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
      console.error('[flight-planner] runtime error:', error, info);
    }

    render() {
      if (this.state.error) {
        return (
          <div
            className="kfp-root"
            style={{
              padding: 24,
              overflow: 'auto',
              fontFamily:
                "-apple-system, 'SF Pro Text', system-ui, sans-serif",
              color: 'rgb(var(--kfp-fg, 20 20 24))',
            }}
          >
            <h2
              style={{
                fontSize: 18,
                fontWeight: 600,
                marginBottom: 8,
                color: 'rgb(var(--kfp-danger, 220 68 58))',
              }}
            >
              Flight planner crashed
            </h2>
            <p style={{ marginBottom: 12, fontSize: 13 }}>
              {this.state.error.name}: {this.state.error.message}
            </p>
            <pre
              style={{
                fontFamily: "'SF Mono', ui-monospace, monospace",
                fontSize: 11,
                background: 'rgb(0 0 0 / 0.05)',
                padding: 12,
                borderRadius: 8,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: '60vh',
                overflow: 'auto',
              }}
            >
              {this.state.error.stack}
            </pre>
            <button
              type="button"
              style={{
                marginTop: 12,
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid rgb(0 0 0 / 0.15)',
                background: 'transparent',
                cursor: 'pointer',
              }}
              onClick={() => this.setState({ error: null })}
            >
              Retry
            </button>
          </div>
        );
      }
      return this.props.children;
    }
  }

  return PluginErrorBoundary;
}
