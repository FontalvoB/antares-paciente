import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useT } from '../i18n/I18nContext'

function ErrorFallback() {
  const t = useT()
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: 360,
          width: '100%',
          textAlign: 'center',
          background: '#0B2B4A',
          color: '#fff',
          padding: 28,
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>
          {t('Algo salió mal al mostrar la comunidad')}
        </div>
        <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 18 }}>
          {t('Ocurrió un error inesperado. Puedes intentar recargar la página.')}
        </div>
        <button
          className="bt bt-pur"
          onClick={() => window.location.reload()}
        >
          {t('Recargar')}
        </button>
      </div>
    </div>
  )
}

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback />
    }

    return this.props.children
  }
}
