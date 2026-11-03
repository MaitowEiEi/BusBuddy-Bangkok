import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}
interface State {
  error: Error | null;
}

/** Shows a message instead of a blank screen when a panel crashes. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[BusBuddy] panel crashed', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="m-4 rounded-2xl bg-red-50 p-4 text-red-900 ring-1 ring-red-200">
        <p className="font-semibold">ส่วนนี้แสดงผลไม่สำเร็จ</p>
        <p className="mt-1 text-sm">ข้อมูลบางส่วนอาจยังไม่รองรับ ลองกลับไปหน้าหลักแล้วเลือกใหม่</p>
        {this.props.onReset && (
          <button
            type="button"
            onClick={this.props.onReset}
            className="mt-3 min-h-11 rounded-xl bg-white px-4 font-semibold ring-1 ring-red-300 hover:bg-red-100"
          >
            กลับหน้าหลัก
          </button>
        )}
      </div>
    );
  }
}