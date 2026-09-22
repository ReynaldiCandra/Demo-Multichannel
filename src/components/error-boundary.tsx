'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';

type Props = { children: ReactNode; resetKey?: string };
type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  componentDidUpdate(previous: Props) {
    if (previous.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="state">
        <CircleAlert size={24} />
        <strong>Ada yang bermasalah di halaman ini</strong>
        <span>Muat ulang halaman untuk mencoba lagi.</span>
        <button className="btn btn-secondary" onClick={() => window.location.reload()}>
          Muat ulang
        </button>
      </div>
    );
  }
}
