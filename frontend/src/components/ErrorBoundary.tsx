import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { IconAlertTriangle, IconRotateCcw } from './icons'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Verity ErrorBoundary caught an error:', error, errorInfo)
  }

  public handleReset = () => {
    localStorage.removeItem('verity_notes_v3')
    window.location.reload()
  }

  public handleReload = () => {
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            width: '100vw',
            backgroundColor: 'var(--bg-deep, #1e1e2e)',
            color: 'var(--text-main, #cdd6f4)',
            padding: 24,
            textAlign: 'center',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          }}
        >
          <div
            style={{
              maxWidth: 520,
              padding: 32,
              borderRadius: 12,
              backgroundColor: 'var(--bg-surface, #181825)',
              border: '1px solid var(--border-color, #313244)',
              boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                backgroundColor: 'rgba(243, 139, 168, 0.15)',
                color: 'var(--ctp-red, #f38ba8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <IconAlertTriangle size={24} />
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
              Something went wrong in Verity
            </h2>

            <p style={{ fontSize: 13, color: 'var(--text-muted, #a6adc8)', margin: 0, lineHeight: 1.5 }}>
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </p>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                className="btn-primary"
                onClick={this.handleReload}
                style={{
                  backgroundColor: 'var(--ctp-blue, #89b4fa)',
                  color: 'var(--ctp-crust, #11111b)',
                  padding: '8px 16px',
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  border: 'none'
                }}
              >
                Reload Workspace
              </button>
              <button
                className="btn-secondary"
                onClick={this.handleReset}
                style={{
                  backgroundColor: 'var(--ctp-surface0, #313244)',
                  color: 'var(--text-main, #cdd6f4)',
                  padding: '8px 16px',
                  borderRadius: 6,
                  fontSize: 13,
                  cursor: 'pointer',
                  border: '1px solid var(--border-color, #45475a)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <IconRotateCcw size={14} />
                Reset Local Storage
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
