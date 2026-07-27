import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React render tree:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[var(--color-asura-dark)] flex items-center justify-center p-4 text-white text-right" dir="rtl">
          <div className="max-w-md w-full bg-[var(--color-asura-card)] border border-[var(--color-asura-border)] rounded-2xl p-8 text-center shadow-2xl">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-black mb-2">خطایی در بارگذاری این صفحه رخ داد</h2>
            <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
              متأسفانه خطای غیرمنتظره‌ای هنگام نمایش اطلاعات رخ داده است. جای نگرانی نیست، می‌توانید مجدداً تلاش کنید یا به صفحه اصلی بازگردید.
            </p>
            {this.state.error?.message && (
              <div className="mb-6 p-3 bg-black/40 border border-white/5 rounded-xl text-left text-[11px] font-mono text-red-400 overflow-x-auto max-h-24">
                {this.state.error.message}
              </div>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="flex-1 py-2.5 bg-[var(--color-asura-accent)] hover:bg-[var(--color-asura-accent-hover)] text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw size={14} />
                تلاش مجدد
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 border border-white/5"
              >
                <Home size={14} />
                صفحه اصلی
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
export default ErrorBoundary;
