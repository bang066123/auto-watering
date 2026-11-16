import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import DatasensorPage from './pages/DatasensorPage';
import Navbar from './components/Navbar';
import ProfileModal from './components/ProfileModal';
import wsClient from './services/wsIndex';
import { Loader2 } from 'lucide-react';

function MainApp() {
  const { isAuthenticated, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      wsClient.connect();
      const unsub = wsClient.onConnectionChange((connected) => {
        setIsWsConnected(connected);
      });
      return () => {
        unsub();
        wsClient.disconnect();
      };
    } else {
      wsClient.disconnect();
    }
  }, [isAuthenticated]);

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
        color: '#64748b',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <Loader2 size={32} className="spin" color="var(--primary)" />
        <div style={{ fontSize: '0.92rem', fontWeight: 500 }}>Đang khởi tạo hệ thống Smart Watering...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="app-container">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isWsConnected={isWsConnected}
        onOpenProfile={() => setIsProfileOpen(true)}
      />

      {/* Cả 4 trang luôn được gắn vào cây giao diện, chuyển tab chỉ ẩn/hiện.
          Nhờ vậy biểu đồ, bộ lọc và vị trí trang được giữ nguyên, không nạp lại dữ liệu. */}
      <main className="main-content">
        {/* Bốn trang xếp chồng tuyệt đối trong cùng một khung và luôn giữ nguyên kích thước.
            Chuyển tab chỉ đổi visibility, KHÔNG dùng display:none — vì display:none làm
            chiều rộng về 0, khiến biểu đồ Recharts phải đo lại và vẽ lại từ đầu,
            nhìn y như đang nạp lại dữ liệu. */}
        <div style={{ position: 'relative', height: '100%' }}>
          {[
            { id: 'dashboard', node: <DashboardPage /> },
            { id: 'datasensor', node: <DatasensorPage /> },
          ].map(({ id, node }) => {
            const isActive = activeTab === id;
            return (
              <div
                key={id}
                style={{
                  position: 'absolute',
                  inset: 0,
                  visibility: isActive ? 'visible' : 'hidden',
                  pointerEvents: isActive ? 'auto' : 'none',
                  zIndex: isActive ? 1 : 0,
                }}
              >
                {node}
              </div>
            );
          })}
        </div>
      </main>

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
