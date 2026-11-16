import React, { useState, useEffect } from 'react';
import { X, Sliders, Settings, Droplets, Gauge, Cpu, Check, AlertCircle, Save } from 'lucide-react';
import api from '../services/index';

export default function DeviceModal({ isOpen, onClose, onSaveSuccess }) {
  const [deviceName, setDeviceName] = useState('Máy bơm nước tưới cây');
  const [gpioPin, setGpioPin] = useState('Pin 25 (PWM Output)');
  const [lowThreshold, setLowThreshold] = useState(50);
  const [highThreshold, setHighThreshold] = useState(75);
  const [pwmSpeed, setPwmSpeed] = useState(220);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Load cấu hình hiện tại khi mở modal
  useEffect(() => {
    if (!isOpen) {
      setMessage('');
      setError('');
      return;
    }

    const fetchConfig = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get('/devices/pump/config');
        if (res.data) {
          if (res.data.deviceName) setDeviceName(res.data.deviceName);
          if (res.data.gpioPin) setGpioPin(res.data.gpioPin);
          if (res.data.lowThreshold != null) setLowThreshold(Number(res.data.lowThreshold));
          if (res.data.highThreshold != null) setHighThreshold(Number(res.data.highThreshold));
          if (res.data.pwmSpeed != null) setPwmSpeed(Number(res.data.pwmSpeed));
        }
      } catch (err) {
        console.warn('Không thể tải cấu hình máy bơm từ server, sử dụng mặc định:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (lowThreshold >= highThreshold) {
      setError('Ngưỡng bật bơm phải nhỏ hơn ngưỡng tắt bơm để chu kỳ tưới hoạt động chính xác!');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        deviceName: deviceName.trim(),
        gpioPin,
        lowThreshold: Number(lowThreshold),
        highThreshold: Number(highThreshold),
        pwmSpeed: Number(pwmSpeed),
      };

      const res = await api.post('/devices/pump/config', payload);
      setMessage('Đã lưu cấu hình và đồng bộ tức thì xuống vi điều khiển ESP32 qua MQTT!');
      if (onSaveSuccess) {
        onSaveSuccess(payload);
      }
      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err) {
      setError('Lỗi khi lưu cấu hình: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  const pwmPercent = Math.round((pwmSpeed / 255) * 100);

  return (
    <div className="modal-backdrop" onClick={onClose} style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(3px)'
    }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '540px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
        animation: 'modalFadeIn 0.2s ease-out'
      }}>
        {/* Header Modal */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(to right, #f8fafc, #f1f5f9)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: '#dbeafe',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Sliders size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Cấu hình tham số thiết bị (DeviceModal)
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '2px 0 0 0' }}>
                Hệ thống tưới tự động thông minh • Auto Watering IoT
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#64748b',
            padding: '6px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center'
          }}>
            <X size={20} />
          </button>
        </div>

        {/* Thông báo trạng thái */}
        {message && (
          <div style={{
            margin: '16px 24px 0',
            padding: '10px 14px',
            borderRadius: '8px',
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            color: '#15803d',
            fontSize: '0.86rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Check size={16} /> {message}
          </div>
        )}

        {error && (
          <div style={{
            margin: '16px 24px 0',
            padding: '10px 14px',
            borderRadius: '8px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            fontSize: '0.86rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Body Form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Hàng 1: Tên thiết bị & Chân GPIO */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Tên thiết bị <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                required
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="VD: Máy bơm nước tưới cây"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  outline: 'none',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Chân GPIO điều khiển
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 12px',
                borderRadius: '8px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                color: '#1e293b',
                fontSize: '0.88rem',
                fontWeight: 600
              }}>
                <Cpu size={16} color="#3b82f6" />
                <span>{gpioPin}</span>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #f1f5f9', margin: '4px 0' }} />

          {/* Hàng 2: Cài đặt ngưỡng độ ẩm bật bơm */}
          <div style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '14px 16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Droplets size={18} color="#ef4444" />
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>
                  Ngưỡng độ ẩm bật bơm (Đất khô)
                </span>
              </div>
              <div style={{
                backgroundColor: '#fee2e2',
                color: '#b91c1c',
                padding: '3px 10px',
                borderRadius: '20px',
                fontWeight: 700,
                fontSize: '0.9rem'
              }}>
                {lowThreshold}%
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <input
                type="range"
                min="10"
                max="85"
                step="1"
                value={lowThreshold}
                onChange={(e) => setLowThreshold(Number(e.target.value))}
                style={{ flex: 1, accentColor: '#ef4444', cursor: 'pointer' }}
              />
              <input
                type="number"
                min="10"
                max="85"
                value={lowThreshold}
                onChange={(e) => setLowThreshold(Number(e.target.value))}
                style={{
                  width: '65px',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  textAlign: 'center',
                  fontWeight: 600,
                  fontSize: '0.88rem'
                }}
              />
            </div>
            <p style={{ margin: '6px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
              • Hệ thống sẽ <strong>tự động bật bơm</strong> khi độ ẩm đất đo được thấp hơn ngưỡng này (Mặc định: 50%).
            </p>
          </div>

          {/* Hàng 3: Cài đặt ngưỡng độ ẩm tắt bơm */}
          <div style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '14px 16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Droplets size={18} color="#10b981" />
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>
                  Ngưỡng độ ẩm tắt bơm (Đất đủ ẩm)
                </span>
              </div>
              <div style={{
                backgroundColor: '#dcfce7',
                color: '#15803d',
                padding: '3px 10px',
                borderRadius: '20px',
                fontWeight: 700,
                fontSize: '0.9rem'
              }}>
                {highThreshold}%
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <input
                type="range"
                min="30"
                max="95"
                step="1"
                value={highThreshold}
                onChange={(e) => setHighThreshold(Number(e.target.value))}
                style={{ flex: 1, accentColor: '#10b981', cursor: 'pointer' }}
              />
              <input
                type="number"
                min="30"
                max="95"
                value={highThreshold}
                onChange={(e) => setHighThreshold(Number(e.target.value))}
                style={{
                  width: '65px',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  textAlign: 'center',
                  fontWeight: 600,
                  fontSize: '0.88rem'
                }}
              />
            </div>
            <p style={{ margin: '6px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
              • Hệ thống sẽ <strong>tự động ngắt bơm</strong> khi đất đạt hoặc vượt qua độ ẩm này (Mặc định: 75%).
            </p>
          </div>

          {/* Hàng 4: Tốc độ xung PWM máy bơm */}
          <div style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '14px 16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Gauge size={18} color="#2563eb" />
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>
                  Tốc độ xung PWM máy bơm
                </span>
              </div>
              <div style={{
                backgroundColor: '#dbeafe',
                color: '#1d4ed8',
                padding: '3px 10px',
                borderRadius: '20px',
                fontWeight: 700,
                fontSize: '0.9rem'
              }}>
                {pwmSpeed}/255 ({pwmPercent}%)
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <input
                type="range"
                min="0"
                max="255"
                step="5"
                value={pwmSpeed}
                onChange={(e) => setPwmSpeed(Number(e.target.value))}
                style={{ flex: 1, accentColor: '#2563eb', cursor: 'pointer' }}
              />
              <input
                type="number"
                min="0"
                max="255"
                value={pwmSpeed}
                onChange={(e) => setPwmSpeed(Number(e.target.value))}
                style={{
                  width: '65px',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  textAlign: 'center',
                  fontWeight: 600,
                  fontSize: '0.88rem'
                }}
              />
            </div>
            <p style={{ margin: '6px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
              • Điều khiển công suất và tốc độ động cơ máy bơm qua xung PWM Pin 25 (Mặc định: 220/255 ~ 86%).
            </p>
          </div>

          {/* Nút hành động */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            marginTop: '8px',
            paddingTop: '12px',
            borderTop: '1px solid #f1f5f9'
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                padding: '9px 18px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#475569',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '9px 22px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
              }}
            >
              <Save size={16} />
              {saving ? 'Đang gửi xuống ESP32...' : 'Lưu & Áp dụng xuống ESP32'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

