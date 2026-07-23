import { Component } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled application error', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="fatal-error glass-panel" role="alert">
          <h1>{this.props.title}</h1>
          <p>{this.props.message}</p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            {this.props.reloadLabel}
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}

export default function AppErrorBoundary({ children }) {
  const { t } = useLanguage();
  return (
    <ErrorBoundary
      title={t('unexpectedErrorTitle')}
      message={t('unexpectedErrorMessage')}
      reloadLabel={t('reloadApp')}
    >
      {children}
    </ErrorBoundary>
  );
}
