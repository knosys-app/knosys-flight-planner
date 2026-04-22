import type { ReactNode } from 'react';
import type { SharedDependencies } from '../types';

/**
 * Bulletproof error boundary — uses only inline styles and no plugin
 * CSS variables, so it renders visibly even if our stylesheet didn't
 * load or produced an invalid rule that broke the sheet.
 */
export function createPluginErrorBoundary(Shared: SharedDependencies) {
  const { React } = Shared;

  class PluginErrorBoundary extends React.Component<
    { children: ReactNode; label?: string },
    { error: Error | null }
  > {
    constructor(props: { children: ReactNode; label?: string }) {
      super(props);
      this.state = { error: null };
    }

    static getDerivedStateFromError(error: Error) {
      return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
      console.error(
        `[flight-planner] ${this.props.label ?? 'root'} boundary caught:`,
        error,
        info,
      );
    }

    render() {
      if (this.state.error) {
        return (
          <div
            style={{
              position: 'relative',
              padding: 20,
              minHeight: 120,
              width: '100%',
              background: '#fff6f5',
              color: '#641e1e',
              fontFamily:
                "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif",
              overflow: 'auto',
              border: '2px solid #c33',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              Flight planner crashed
              {this.props.label ? ` (${this.props.label})` : ''}
            </div>
            <div style={{ fontSize: 13, marginBottom: 12 }}>
              <strong>{this.state.error.name}:</strong>{' '}
              {this.state.error.message}
            </div>
            <pre
              style={{
                fontFamily: 'ui-monospace, Menlo, monospace',
                fontSize: 11,
                background: '#fff',
                color: '#222',
                padding: 12,
                borderRadius: 6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: '60vh',
                overflow: 'auto',
                border: '1px solid #d6bcbc',
              }}
            >
              {this.state.error.stack}
            </pre>
            <button
              type="button"
              style={{
                marginTop: 12,
                padding: '8px 14px',
                borderRadius: 6,
                border: '1px solid #c33',
                background: '#c33',
                color: 'white',
                cursor: 'pointer',
                fontSize: 13,
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
