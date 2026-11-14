import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

class ErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="wa-empty" role="alert">
        <h1>Không thể mở ứng dụng</h1>
        <p>
          Kiểm tra cấu hình VITE_API_BASE_URL và tải lại trang. Nếu lỗi tiếp
          tục, liên hệ người phụ trách.
        </p>
        <button onClick={() => location.reload()}>Tải lại</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
