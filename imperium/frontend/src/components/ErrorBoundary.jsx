import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState(prev => ({ hasError: false, error: null, retryCount: prev.retryCount + 1 }));
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback({ error: this.state.error, reset: this.handleReset });
      }

      const maxRetries = this.state.retryCount >= 2;

      return (
        <div role="alert" style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '60vh', padding: '2rem', textAlign: 'center'
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(239,68,68,0.08)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem',
          }}>
            <span style={{ fontSize: '1.75rem' }}>!</span>
          </div>
          <h2 style={{ color: '#1a2a4a', marginBottom: '0.75rem', fontSize: '1.15rem', fontWeight: 700 }}>
            Une erreur est survenue
          </h2>
          <p style={{ color: '#64748b', marginBottom: '1.5rem', maxWidth: '400px', fontSize: '0.88rem', lineHeight: 1.5 }}>
            {maxRetries
              ? 'Le problème persiste. Essayez de recharger la page.'
              : "L'application a rencontré un problème inattendu. Veuillez réessayer."
            }
          </p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {!maxRetries && (
              <button
                onClick={this.handleReset}
                style={{
                  padding: '0.65rem 1.5rem', background: '#1a2a4a', color: 'white',
                  border: 'none', borderRadius: '8px', cursor: 'pointer',
                  fontSize: '0.9rem', fontWeight: 600,
                }}
              >
                Réessayer
              </button>
            )}
            <button
              onClick={this.handleReload}
              style={{
                padding: '0.65rem 1.5rem',
                background: maxRetries ? '#1a2a4a' : 'transparent',
                color: maxRetries ? 'white' : '#64748b',
                border: maxRetries ? 'none' : '1px solid #e2e8f0',
                borderRadius: '8px', cursor: 'pointer',
                fontSize: '0.9rem', fontWeight: 600,
              }}
            >
              Recharger la page
            </button>
          </div>
          {this.state.retryCount > 0 && (
            <p style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '1rem' }}>
              {this.state.retryCount} tentative{this.state.retryCount > 1 ? 's' : ''} échouée{this.state.retryCount > 1 ? 's' : ''}
            </p>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
