import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Activity,
  User as UserIcon,
  LogOut,
  Wifi,
  WifiOff,
  Droplets
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import wsClient from '../services/wsIndex';
import { espApi } from '../services/index';

export default function Navbar({ activeTab, setActiveTab, isWsConnected, onOpenProfile }) {
  const { user, logout } = useAuth();
  const [deviceStatus, setDeviceStatus] = useState({ online: false, ping: null });

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await espApi.getStatus();
        setDeviceStatus({
          online: !!(data && data.online !== false),
          ping: data?.ping ?? null,
        });
      } catch (err) {
        console.warn('Không đọc được trạng thái ESP8266', err);
        setDeviceStatus({ online: false, ping: null });
      }
    };

    fetchStatus();

    const unsubEsp = wsClient.onEspStatus((data) => {
      if (!data) return;
      setDeviceStatus({
        online: data.online !== false,
        ping: data.ping ?? null,
      });
    });

    const unsubMqtt = wsClient.onMqttStatus((data) => {
      if (!data) return;
      if (data.connected) {
        setDeviceStatus((prev) => ({
          ...prev,
          online: true,
          ping: prev.ping || 15,
        }));
      }
    });

    return () => {
      unsubEsp();
      unsubMqtt();
    };
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'datasensor', label: 'Dữ liệu cảm biến', icon: Activity },
  ];

  return (
    <header style={{
      background: '#ffffff',
      borderBottom: '1px solid var(--border)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
    }}>
      <div style={{
        maxWidth: '1240px',
        margin: '0 auto',
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '64px'
      }}>
        {/* Logo & Tiêu đề */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #0284c7, #06b6d4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)'
          }}>
            <Droplets size={22} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f172a', letterSpacing: '-0.01em' }}>
              Smart Watering
            </div>
            <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 500 }}>
              IoT System
            </div>
          </div>
        </div>

        {/* 4 Tab điều hướng chính */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 13px',
                  borderRadius: '8px',
                  fontSize: '0.88rem',
                  whiteSpace: 'nowrap',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#2563eb' : '#475569',
                  backgroundColor: isActive ? '#eff6ff' : 'transparent',
                  border: isActive ? '1px solid #bfdbfe' : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={18} color={isActive ? '#2563eb' : '#64748b'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Trạng thái phần cứng, Hồ sơ & Đăng xuất */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Trạng thái kênh thời gian thực (WebSocket / STOMP) */}
          <div
            title={isWsConnected
              ? 'Đã kết nối kênh thời gian thực tới máy chủ'
              : 'Mất kết nối kênh thời gian thực - dữ liệu không tự cập nhật'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '9999px',
              fontSize: '0.78rem',
              fontWeight: 600,
              backgroundColor: isWsConnected ? '#eff6ff' : '#f8fafc',
              color: isWsConnected ? '#1d4ed8' : '#64748b',
              border: `1px solid ${isWsConnected ? '#bfdbfe' : 'var(--border)'}`
            }}
          >
            <span style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: isWsConnected ? '#2563eb' : '#cbd5e1'
            }} />
            <span>{isWsConnected ? 'Realtime' : 'Offline'}</span>
          </div>

          {deviceStatus.online ? (
            <div
              title={`Mạch NodeMCU ESP8266 đang hoạt động • Ping: ${deviceStatus.ping != null ? `${deviceStatus.ping}ms` : '< 50ms'}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '9999px',
                fontSize: '0.78rem',
                fontWeight: 600,
                backgroundColor: '#ecfdf5',
                color: '#065f46',
                border: '1px solid #a7f3d0'
              }}
            >
              <Wifi size={14} />
              <span>Ping: {deviceStatus.ping != null ? `${deviceStatus.ping}ms` : '< 50ms'}</span>
            </div>
          ) : (
            <div
              title="Mạch NodeMCU ESP8266 chưa cấp điện hoặc ngắt kết nối (Ping: N/A)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '9999px',
                fontSize: '0.78rem',
                fontWeight: 600,
                backgroundColor: '#fef2f2',
                color: '#dc2626',
                border: '1px solid #fecaca'
              }}
            >
              <WifiOff size={14} />
              <span>Ping: N/A</span>
            </div>
          )}

          <button
            onClick={onOpenProfile}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              backgroundColor: '#ffffff',
              cursor: 'pointer',
              fontSize: '0.88rem',
              color: '#1e293b'
            }}
            title="Xem hồ sơ cá nhân Quản trị viên"
          >
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: '#e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#334155'
            }}>
              <UserIcon size={14} />
            </div>
            <span style={{ fontWeight: 600 }}>{user?.name || 'Nhóm 11'}</span>
          </button>

          <button
            onClick={logout}
            style={{
              padding: '8px',
              borderRadius: '8px',
              color: '#64748b',
              border: '1px solid var(--border)',
              backgroundColor: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Đăng xuất khỏi hệ thống"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
