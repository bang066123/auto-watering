// ===================================================================
// FILE: src/pages/DashboardPage.jsx
// CHỨC NĂNG: Trang tổng quan điều khiển tưới thông minh ESP32
// ===================================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  Thermometer,
  Droplets,
  Layers,
  CloudRain,
  Power,
  Sparkles,
  Hand,
  Loader2,
  RefreshCw,
  Cpu,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Bell,
  Info,
  ShieldAlert,
  WifiOff,
  ChevronLeft,
  ChevronRight,
  Settings,
  Sliders
} from 'lucide-react';
import DeviceModal from '../components/DeviceModal';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { deviceApi, sensorApi, alertApi, espApi } from '../services/index';
import wsClient from '../services/wsIndex';
import axios from 'axios';

export default function DashboardPage() {
  const [sensors, setSensors] = useState({
    online: false,
    temperature: null,
    humidity: null,
    soilMoisture: null,
    rain: 'No Rain',
    rainVal: null,
    rainLevel: 0,
    time: null,
  });

  const [chartData, setChartData] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [pendingDevices, setPendingDevices] = useState({});
  const [actionError, setActionError] = useState('');
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [pumpConfig, setPumpConfig] = useState({
    lowThreshold: 50,
    highThreshold: 75,
    pwmSpeed: 220,
    deviceName: 'Máy bơm nước (PWM Pin 25)'
  });
  const [latestCycle, setLatestCycle] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [espOnline, setEspOnline] = useState(null);
  const [alertPage, setAlertPage] = useState(0);
  const [alertSize, setAlertSize] = useState(8);
  const [alertTotalPages, setAlertTotalPages] = useState(1);
  const [alertTotalElements, setAlertTotalElements] = useState(0);
  const [alertTypeFilter, setAlertTypeFilter] = useState('');
  const [newAlertIds, setNewAlertIds] = useState(() => new Set());
  const newAlertTimer = useRef(null);
  const alertFilterRef = useRef({ page: 0, size: 8, type: '' });

  useEffect(() => {
    alertFilterRef.current = { page: alertPage, size: alertSize, type: alertTypeFilter };
  }, [alertPage, alertSize, alertTypeFilter]);

  const loadAlerts = async (targetPage = alertPage, targetSize = alertSize, targetType = alertTypeFilter, silent = false) => {
    try {
      if (!silent) setLoadingAlerts(true);
      const params = { page: targetPage, size: targetSize };
      if (targetType) params.type = targetType;
      const res = await alertApi.getAll(params);
      if (res && res.content) {
        setAlerts(res.content);
        setAlertTotalPages(res.totalPages || 1);
        setAlertTotalElements(res.totalElements || 0);
        setAlertPage(res.number || 0);
      } else if (Array.isArray(res)) {
        setAlerts(res);
        setAlertTotalPages(1);
        setAlertTotalElements(res.length);
      }
    } catch (err) {
      console.warn('Không thể tải danh sách cảnh báo', err);
    } finally {
      if (!silent) setLoadingAlerts(false);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage < 0 || newPage >= alertTotalPages) return;
    setAlertPage(newPage);
    loadAlerts(newPage, alertSize, alertTypeFilter);
  };

  const handleSizeChange = (newSize) => {
    setAlertSize(newSize);
    setAlertPage(0);
    loadAlerts(0, newSize, alertTypeFilter);
  };

  const handleTypeChange = (newType) => {
    setAlertTypeFilter(newType);
    setAlertPage(0);
    loadAlerts(0, alertSize, newType);
  };

  const loadEspStatus = async () => {
    try {
      const res = await espApi.getStatus();
      if (res) {
        setEspOnline(res.pumpOnline || res.rainOnline);
      }
    } catch (e) {
      setEspOnline(false);
    }
  };

  const loadDevices = async () => {
    try {
      setLoadingDevices(true);
      const list = await deviceApi.getAll();
      if (Array.isArray(list) && list.length > 0) {
        setDevices(list);
      }
    } catch (err) {
      console.warn('Không thể tải danh sách thiết bị', err);
    } finally {
      setLoadingDevices(false);
    }
  };

  const loadPumpConfig = async () => {
    try {
      const res = await axios.get('/api/devices/pump/config');
      if (res.data) {
        setPumpConfig((prev) => ({
          ...prev,
          lowThreshold: res.data.lowThreshold != null ? Number(res.data.lowThreshold) : prev.lowThreshold,
          highThreshold: res.data.highThreshold != null ? Number(res.data.highThreshold) : prev.highThreshold,
          pwmSpeed: res.data.pwmSpeed != null ? Number(res.data.pwmSpeed) : prev.pwmSpeed,
          deviceName: res.data.deviceName || prev.deviceName
        }));
      }
    } catch (err) {
      // Ignored
    }
  };

  const loadLatestSensors = async () => {
    try {
      const data = await sensorApi.getLatest();
      if (data) {
        setSensors((prev) => ({
          ...prev,
          temperature: data.temperature != null ? Number(data.temperature) : prev.temperature,
          humidity: data.humidity != null ? Number(data.humidity) : prev.humidity,
          soilMoisture: data.soil_moisture != null ? Number(data.soil_moisture) : prev.soilMoisture,
          rain: data.rain != null ? String(data.rain) : prev.rain,
          time: new Date().toLocaleTimeString('vi-VN'),
        }));
      }
    } catch (err) {
      console.warn('Không đọc được số đo mới nhất', err);
    }
  };

  const loadLatestCycle = async () => {
    try {
      const res = await axios.get('/api/cycles?limit=1');
      if (Array.isArray(res.data) && res.data.length > 0) {
        setLatestCycle(res.data[0]);
      }
    } catch (e) {}
  };

  const loadChartData = async () => {
    try {
      const list = await sensorApi.getRecentChart();
      if (Array.isArray(list) && list.length > 0) {
        const mapByTime = new Map();
        for (const item of list) {
          const tStr = item.time || '';
          if (!mapByTime.has(tStr)) {
            mapByTime.set(tStr, { time: tStr });
          }
          const pt = mapByTime.get(tStr);
          const st = (item.sensorType || item.sensor?.sensorType || '').toLowerCase();
          const val = Number(item.value);
          if (st.includes('temp')) pt.temperature = val;
          else if (st.includes('hum')) pt.humidity = val;
          else if (st.includes('soil')) pt.soilMoisture = val;
          else if (st.includes('rain')) pt.rain = val;
        }
        setChartData(Array.from(mapByTime.values()));
      }
    } catch (err) {
      console.warn('Không nạp được dữ liệu biểu đồ', err);
    }
  };

  useEffect(() => {
    loadLatestSensors();
    loadChartData();
    loadDevices();
    loadPumpConfig();
    loadLatestCycle();
    loadAlerts();
    loadEspStatus();

    const offSensor = wsClient.onSensorData((data) => {
      if (!data) return;
      setSensors((prev) => ({
        ...prev,
        online: true,
        temperature: data.temperature != null ? Number(data.temperature) : prev.temperature,
        humidity: data.humidity != null ? Number(data.humidity) : prev.humidity,
        soilMoisture: data.soilMoisture != null ? Number(data.soilMoisture) : prev.soilMoisture,
        rain: data.rain ?? prev.rain,
        rainVal: data.rainVal ?? prev.rainVal,
        rainLevel: data.rainLevel ?? prev.rainLevel,
        time: new Date().toLocaleTimeString('vi-VN'),
      }));

      // Đồng bộ ngưỡng độ ẩm và tốc độ PWM nếu có trong telemetry
      if (data.lowThreshold != null || data.highThreshold != null || data.pwmSpeed != null) {
        setPumpConfig((prev) => ({
          ...prev,
          lowThreshold: data.lowThreshold != null ? Number(data.lowThreshold) : prev.lowThreshold,
          highThreshold: data.highThreshold != null ? Number(data.highThreshold) : prev.highThreshold,
          pwmSpeed: data.pwmSpeed != null ? Number(data.pwmSpeed) : prev.pwmSpeed
        }));
      }

      // Đồng bộ tức thời trạng thái máy bơm & chế độ từ gói đo telemetry
      if (data.mode != null) {
        const isAuto = String(data.mode).toUpperCase() === 'AUTO';
        setDevices((prev) =>
          prev.map((d) => ((d.type || '').toUpperCase() === 'MODE' ? { ...d, isActive: isAuto } : d))
        );
      }
      if (data.pump != null) {
        const isPumpOn = String(data.pump).toUpperCase() === 'ON';
        setDevices((prev) =>
          prev.map((d) => ((d.type || '').toUpperCase() === 'PUMP' ? { ...d, isActive: isPumpOn } : d))
        );
      }

      // Khi phát hiện có mưa, lập tức chuyển trạng thái máy bơm sang TẮT
      if (data.rainLevel != null && Number(data.rainLevel) >= 1) {
        setDevices((prev) =>
          prev.map((d) => ((d.type || '').toUpperCase() === 'PUMP' ? { ...d, isActive: false } : d))
        );
      }

      if (data.temperature != null || data.soilMoisture != null) {
        const timeStr = new Date().toLocaleTimeString('vi-VN');
        setChartData((prev) => {
          const next = [...prev, {
            time: timeStr,
            temperature: data.temperature != null ? Number(data.temperature) : undefined,
            humidity: data.humidity != null ? Number(data.humidity) : undefined,
            soilMoisture: data.soilMoisture != null ? Number(data.soilMoisture) : undefined,
          }];
          return next.slice(-25);
        });
      }
    });

    const offDevice = wsClient.onDeviceStatus((data) => {
      if (!data) return;
      const id = data.id || data.deviceId;
      const type = (data.type || '').toUpperCase();

      // Không gán lại PENDING vào state để tránh làm nút bị xoay loading trở lại
      if (data.status === 'PENDING') {
        return;
      }

      setPendingDevices((prev) => {
        if (id && prev[id]) {
          const next = { ...prev };
          delete next[id];
          return next;
        }
        return prev;
      });

      if (data.status === 'SUCCESS' || data.isActive != null) {
        const nextActive = data.isActive != null
          ? Boolean(data.isActive)
          : (data.action === 'ON' || data.action === 'AUTO');
        setDevices((prev) =>
          prev.map((d) => {
            if (id && d.id === Number(id)) return { ...d, isActive: nextActive };
            if (type && (d.type || '').toUpperCase() === type) return { ...d, isActive: nextActive };
            return d;
          })
        );
      }
    });

    const offAlert = wsClient.onAlert((newAlert) => {
      if (!newAlert) return;
      const { page, size, type } = alertFilterRef.current;
      if (type && newAlert.alertType && newAlert.alertType.toUpperCase() !== type.toUpperCase()) {
        return;
      }
      setAlertTotalElements((prev) => prev + 1);
      // Khi đang ở trang 0, chèn ngay bản ghi mới lên đầu danh sách và highlight
      if (page === 0) {
        setAlerts((prev) => {
          const filtered = prev.filter((a) => a.id !== newAlert.id);
          return [newAlert, ...filtered].slice(0, size);
        });
        setNewAlertIds((prev) => new Set([...prev, newAlert.id]));
        clearTimeout(newAlertTimer.current);
        newAlertTimer.current = setTimeout(() => setNewAlertIds(new Set()), 2000);
      }
    });

    const offEsp = wsClient.onEspStatus((data) => {
      if (!data) return;
      setEspOnline(!!(data.pumpOnline || data.rainOnline));
    });

    // Also poll every 3 seconds for robust real-time updates
    const pollTimer = setInterval(() => {
      loadLatestSensors();
      loadDevices();
      loadLatestCycle();
      loadAlerts();
      loadEspStatus();
    }, 3000);

    return () => {
      offSensor();
      offDevice();
      offAlert();
      offEsp();
      clearInterval(pollTimer);
    };
  }, []);

  const handleToggleDevice = async (device) => {
    if (pendingDevices[device.id]) return;

    const isPump = (device.type || '').toUpperCase() === 'PUMP';
    let nextAction = '';

    if (isPump) {
      nextAction = device.isActive ? 'OFF' : 'ON';
    } else {
      // Mode device
      nextAction = device.isActive ? 'MANUAL' : 'AUTO';
    }

    setActionError('');
    // Đánh dấu đang gửi lệnh (hiển thị hiệu ứng loading nhẹ trong tích tắc khi gửi request)
    setPendingDevices((prev) => ({ ...prev, [device.id]: nextAction }));

    try {
      await deviceApi.control(device.id, nextAction);
      // Khi server nhận lệnh & bắn MQTT tới ESP32 thành công, lập tức cập nhật trạng thái UI
      setDevices((prev) =>
        prev.map((d) => {
          if (d.id === device.id) {
            return { ...d, isActive: nextAction === 'ON' || nextAction === 'AUTO' };
          }
          // Nếu bật bơm thủ công mà trước đó đang AUTO, ESP32 sẽ tự chuyển sang MANUAL
          if (isPump && nextAction === 'ON' && (d.type || '').toUpperCase() === 'MODE') {
            return { ...d, isActive: false };
          }
          // Khi chuyển từ AUTO sang MANUAL, máy bơm bắt buộc về trạng thái TẮT
          if (!isPump && nextAction === 'MANUAL' && (d.type || '').toUpperCase() === 'PUMP') {
            return { ...d, isActive: false };
          }
          return d;
        })
      );
    } catch (err) {
      console.error('Lỗi điều khiển thiết bị', err);
      setActionError(`Không thể gửi lệnh tới ${device.name}`);
    } finally {
      // Giải phóng ngay cờ loading để nút bấm phản hồi lập tức, không bắt người dùng chờ ACK
      setPendingDevices((prev) => {
        const next = { ...prev };
        delete next[device.id];
        return next;
      });
    }
  };

  const pumpDevice = devices.find((d) => (d.type || '').toUpperCase() === 'PUMP');
  const modeDevice = devices.find((d) => (d.type || '').toUpperCase() === 'MODE');
  const isAuto = modeDevice ? modeDevice.isActive : true;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      height: '100%',
      overflowY: 'auto',
      overflowX: 'hidden',
      paddingRight: '6px',
      paddingBottom: '32px'
    }}>
      
      {/* BANNER THÔNG BÁO NẾU ESP32 CHƯA KẾT NỐI */}
      {espOnline === false && (
        <div style={{
          backgroundColor: '#fff7ed',
          border: '1px solid #fed7aa',
          borderRadius: '12px',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#9a3412',
          fontSize: '0.86rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <WifiOff size={20} color="#ea580c" />
            <div>
              <strong>Chưa nhận được tín hiệu từ mạch ESP32:</strong> Còi Buzzer và lệnh điều khiển đang chờ kết nối tới Broker{' '}
              <code>10.120.252.148:1884</code>. Vui lòng nạp code mới vào 2 mạch hoặc kiểm tra Wi-Fi.
            </div>
          </div>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#c2410c' }}>
            ĐANG CHỜ KẾT NỐI
          </span>
        </div>
      )}

      {/* 1. KHỐI THÔNG TIN CHU KỲ TƯỚI GẦN NHẤT */}
      {latestCycle && (
        <div style={{
          background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
          border: '1px solid #a7f3d0',
          borderRadius: '12px',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#065f46',
          fontSize: '0.88rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle2 size={20} color="#059669" />
            <div>
              <strong>Chu kỳ tưới thông minh #{latestCycle.cycleId}:</strong> Hoàn thành sau{' '}
              <strong>{latestCycle.durationSeconds || latestCycle.duration_s || 0}s</strong> | Mức tăng:{' '}
              <strong>+{latestCycle.moistureGain || 0}% ẩm</strong> (Khô &lt; 50% &rarr; Đủ ẩm &ge; 75%)
            </div>
          </div>
          <span style={{ fontSize: '0.78rem', color: '#047857' }}>
            {latestCycle.createdAt ? new Date(latestCycle.createdAt).toLocaleTimeString('vi-VN') : ''}
          </span>
        </div>
      )}

      {/* 2. 4 THẺ CHỈ SỐ MÔI TRƯỜNG THỜI GIAN THỰC */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        
        {/* Thẻ 1: Nhiệt độ DHT11 */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', borderLeft: '4px solid #f97316' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ea580c' }}>
            <Thermometer size={26} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Nhiệt độ (DHT11)</div>
            <div style={{ fontSize: '1.7rem', fontWeight: 700, color: '#0f172a' }}>
              {sensors.temperature != null ? `${sensors.temperature}°C` : '--°C'}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 500 }}>Chân 14 ESP32 • Ổn định</div>
          </div>
        </div>

        {/* Thẻ 2: Độ ẩm không khí DHT11 */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', borderLeft: '4px solid #0284c7' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
            <Droplets size={26} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Độ ẩm không khí</div>
            <div style={{ fontSize: '1.7rem', fontWeight: 700, color: '#0f172a' }}>
              {sensors.humidity != null ? `${sensors.humidity}%` : '--%'}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#0284c7', fontWeight: 500 }}>DHT11 • Thích hợp</div>
          </div>
        </div>

        {/* Thẻ 3: Độ ẩm đất */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', borderLeft: '4px solid #10b981' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
            <Layers size={26} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Độ ẩm đất (Soil)</div>
            <div style={{ fontSize: '1.7rem', fontWeight: 700, color: '#0f172a' }}>
              {sensors.soilMoisture != null ? `${sensors.soilMoisture}%` : '--%'}
            </div>
            <div style={{ fontSize: '0.75rem', color: sensors.soilMoisture < 50 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
              {sensors.soilMoisture < 50 ? 'Khô (<50%) - Cần tưới' : (sensors.soilMoisture >= 75 ? 'Đủ ẩm (≥75%)' : 'Lý tưởng (50-75%)')}
            </div>
          </div>
        </div>

        {/* Thẻ 4: Cảm biến mưa */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', borderLeft: '4px solid #6366f1' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>
            <CloudRain size={26} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Cảm biến mưa</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {(() => {
                const r = String(sensors.rain || '').trim();
                const isNoRain = r === '4095' || r === '4095.00' || r.toLowerCase().includes('no rain') || sensors.rainLevel === 0;
                if (isNoRain) return 'Không mưa (Khô ráo)';
                if (r.toLowerCase().includes('light')) return 'Mưa nhỏ';
                if (r.toLowerCase().includes('moderate')) return 'Mưa vừa';
                if (r.toLowerCase().includes('heavy')) return 'Mưa lớn';
                return r || 'Không mưa';
              })()}
            </div>
            <div style={{ fontSize: '0.75rem', color: (sensors.rainLevel >= 1 || (sensors.rain && sensors.rain !== '4095' && !String(sensors.rain).toLowerCase().includes('no rain'))) ? '#ef4444' : '#6366f1', fontWeight: 600 }}>
              {sensors.rainVal != null ? `ADC: ${sensors.rainVal}` : (sensors.rain && sensors.rain !== 'Không mưa' ? `ADC: ${sensors.rain}` : 'rain/data')} • {(sensors.rainLevel >= 1 || (sensors.rain && sensors.rain !== '4095' && !String(sensors.rain).toLowerCase().includes('no rain'))) ? '⚠️ Có mưa - Tự ngắt bơm' : 'Bình thường'}
            </div>
          </div>
        </div>

      </div>

      {/* 3. KHỐI BIỂU ĐỒ BIẾN THIÊN RECHARTS */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
              Biểu đồ biến thiên thông số môi trường & Đất
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Dữ liệu thu thập liên tục từ ESP32 qua giao thức MQTT
            </p>
          </div>
          <button
            onClick={loadChartData}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} /> Làm mới
          </button>
        </div>

        <div style={{ width: '100%', height: '260px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} />
              <YAxis yAxisId="left" stroke="#94a3b8" fontSize={11} domain={[0, 100]} />
              <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }} />
              <Legend wrapperStyle={{ fontSize: '0.85rem', paddingTop: '10px' }} />

              <Line yAxisId="left" type="monotone" dataKey="soilMoisture" name="Độ ẩm đất (%)" stroke="#10b981" strokeWidth={2.6} dot={{ r: 2 }} activeDot={{ r: 5 }} />
              <Line yAxisId="left" type="monotone" dataKey="temperature" name="Nhiệt độ (°C)" stroke="#f97316" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} />
              <Line yAxisId="left" type="monotone" dataKey="humidity" name="Độ ẩm KK (%)" stroke="#0284c7" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} strokeDasharray="3 3" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. KHỐI ĐIỀU KHIỂN PHẦN CỨNG (BƠM & CHẾ ĐỘ) */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Bảng điều khiển thiết bị phần cứng
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '4px 0 0 0' }}>
              Điều khiển rơ-le bơm nước PWM và chuyển đổi chế độ Tự động / Thủ công
            </p>
          </div>
          <button
            onClick={() => setIsConfigModalOpen(true)}
            className="btn btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '7px 14px',
              borderRadius: '8px',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#1e293b',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            <Settings size={16} color="#2563eb" />
            <span>Cấu hình thiết bị</span>
          </button>
        </div>

        {actionError && (
          <div style={{ padding: '10px 14px', marginBottom: '14px', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '0.85rem' }}>
            {actionError}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
          
          {/* Nút 1: Máy bơm nước */}
          {pumpDevice && (
            <div style={{
              border: '1px solid',
              borderColor: pumpDevice.isActive ? '#86efac' : '#e2e8f0',
              borderRadius: '14px',
              padding: '18px',
              backgroundColor: pumpDevice.isActive ? '#f0fdf4' : '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: pumpDevice.isActive ? '0 4px 14px rgba(22, 163, 74, 0.08)' : 'none'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  backgroundColor: pumpDevice.isActive ? '#dcfce7' : '#f1f5f9',
                  color: pumpDevice.isActive ? '#16a34a' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Droplets size={24} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{pumpDevice.name}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setIsConfigModalOpen(true); }}
                      title="Nhấp để mở hộp thoại Cấu hình tham số thiết bị (DeviceModal)"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#64748b',
                        padding: '3px',
                        borderRadius: '4px',
                        display: 'inline-flex',
                        alignItems: 'center'
                      }}
                    >
                      <Settings size={15} />
                    </button>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                    PWM Pin 25: {pumpConfig.pwmSpeed}/255 ({Math.round((pumpConfig.pwmSpeed / 255) * 100)}%) • Ngưỡng: {pumpConfig.lowThreshold}% - {pumpConfig.highThreshold}%
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleToggleDevice(pumpDevice)}
                disabled={pendingDevices[pumpDevice.id] != null}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: pumpDevice.isActive ? '#ef4444' : '#10b981',
                  color: '#ffffff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {pendingDevices[pumpDevice.id] ? <Loader2 size={16} className="spin" /> : <Power size={16} />}
                <span>{pumpDevice.isActive ? 'TẮT BƠM' : 'BẬT BƠM'}</span>
              </button>
            </div>
          )}

          {/* Nút 2: Chế độ vận hành */}
          {modeDevice && (
            <div style={{
              border: '1px solid',
              borderColor: modeDevice.isActive ? '#93c5fd' : '#fde68a',
              borderRadius: '14px',
              padding: '18px',
              backgroundColor: modeDevice.isActive ? '#eff6ff' : '#fffbeb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  backgroundColor: modeDevice.isActive ? '#dbeafe' : '#fef3c7',
                  color: modeDevice.isActive ? '#2563eb' : '#d97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {modeDevice.isActive ? <Sparkles size={24} /> : <Hand size={24} />}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>{modeDevice.name}</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    {modeDevice.isActive ? 'LED Pin 15 SÁNG • Tự động tưới' : 'LED Pin 15 TẮT • Điều khiển tay'}
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleToggleDevice(modeDevice)}
                disabled={pendingDevices[modeDevice.id] != null}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: modeDevice.isActive ? '#2563eb' : '#d97706',
                  color: '#ffffff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {pendingDevices[modeDevice.id] ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
                <span>{modeDevice.isActive ? 'CHẾ ĐỘ AUTO' : 'CHẾ ĐỘ MANUAL'}</span>
              </button>
            </div>
          )}

        </div>
      </div>

      {/* 5. KHỐI CẢNH BÁO & SỰ KIỆN THÔNG MINH (LƯU DB & PHÂN TRANG & REALTIME) */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: '#fef2f2',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Bell size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                Cảnh báo & Sự kiện thông minh
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Nhật ký sự kiện thời gian thực lưu Database: Bắt đầu/hoàn tất chu kỳ tưới, đất khô &lt;50%, ngắt bơm khi trời mưa
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Bộ lọc loại sự kiện */}
            <select
              value={alertTypeFilter}
              onChange={(e) => handleTypeChange(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                backgroundColor: '#ffffff',
                fontSize: '0.82rem',
                color: '#334155',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="">-- Tất cả sự kiện --</option>
              <option value="SUCCESS">Thành công (SUCCESS)</option>
              <option value="WARNING">Cảnh báo mưa (WARNING)</option>
              <option value="INFO">Thông tin (INFO)</option>
            </select>

            <span style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: '9999px',
              backgroundColor: alertTotalElements > 0 ? '#fef3c7' : '#f1f5f9',
              color: alertTotalElements > 0 ? '#b45309' : '#64748b'
            }}>
              {alertTotalElements} sự kiện
            </span>

            <button
              onClick={() => loadAlerts(alertPage, alertSize, alertTypeFilter)}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {loadingAlerts ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />} Làm mới
            </button>
          </div>
        </div>

        {alerts.length === 0 ? (
          <div style={{
            padding: '28px',
            textAlign: 'center',
            backgroundColor: '#f8fafc',
            borderRadius: '12px',
            border: '1px dashed #cbd5e1',
            color: '#64748b',
            fontSize: '0.88rem'
          }}>
            <ShieldAlert size={28} style={{ margin: '0 auto 8px', color: '#94a3b8' }} />
            <div>Chưa có cảnh báo nào phù hợp trong cơ sở dữ liệu.</div>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px' }}>
              Cảnh báo sẽ tự động phát sinh và lưu vào Database khi tưới, ngắt bơm mưa, hoặc chuyển chế độ.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {alerts.map((al) => {
              const isWarning = (al.alertType || '').toUpperCase() === 'WARNING';
              const isSuccess = (al.alertType || '').toUpperCase() === 'SUCCESS';
              const isNew = newAlertIds.has(al.id);

              return (
                <div
                  key={al.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '14px',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    backgroundColor: isWarning ? '#fffbeb' : isSuccess ? '#f0fdf4' : '#f8fafc',
                    border: '1px solid',
                    borderColor: isNew ? '#22c55e' : (isWarning ? '#fde68a' : isSuccess ? '#bbf7d0' : '#e2e8f0'),
                    boxShadow: isNew ? '0 0 0 2px rgba(34, 197, 94, 0.25)' : 'none',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{
                      marginTop: '2px',
                      color: isWarning ? '#d97706' : isSuccess ? '#16a34a' : '#2563eb'
                    }}>
                      {isWarning ? <AlertTriangle size={18} /> : isSuccess ? <CheckCircle2 size={18} /> : <Info size={18} />}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>
                          {al.title || 'Thông báo hệ thống'}
                        </span>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: isWarning ? '#fef3c7' : isSuccess ? '#dcfce7' : '#e0f2fe',
                          color: isWarning ? '#b45309' : isSuccess ? '#15803d' : '#0369a1',
                          textTransform: 'uppercase'
                        }}>
                          {al.alertType || 'INFO'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.84rem', color: '#334155' }}>
                        {al.message}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    fontSize: '0.75rem',
                    color: '#64748b',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginTop: '2px'
                  }}>
                    <Clock size={12} />
                    {al.time ? new Date(al.time).toLocaleString('vi-VN') : ''}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* THANH ĐIỀU HƯỚNG PHÂN TRANG (PAGINATION) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          paddingTop: '10px',
          borderTop: '1px solid var(--border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#64748b' }}>
            <span>Hiển thị</span>
            <select
              value={alertSize}
              onChange={(e) => handleSizeChange(Number(e.target.value))}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: '#ffffff',
                fontSize: '0.82rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value={5}>5 / trang</option>
              <option value={8}>8 / trang</option>
              <option value={10}>10 / trang</option>
              <option value={20}>20 / trang</option>
            </select>
            <span>• Tổng số <strong>{alertTotalElements}</strong> sự kiện</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => handlePageChange(alertPage - 1)}
              disabled={alertPage <= 0 || loadingAlerts}
              className="btn btn-secondary"
              style={{
                padding: '5px 10px',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                opacity: alertPage <= 0 ? 0.5 : 1,
                cursor: alertPage <= 0 ? 'not-allowed' : 'pointer'
              }}
            >
              <ChevronLeft size={14} /> Trước
            </button>

            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', minWidth: '80px', textAlign: 'center' }}>
              Trang {alertPage + 1} / {Math.max(alertTotalPages, 1)}
            </span>

            <button
              onClick={() => handlePageChange(alertPage + 1)}
              disabled={alertPage >= alertTotalPages - 1 || loadingAlerts}
              className="btn btn-secondary"
              style={{
                padding: '5px 10px',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                opacity: alertPage >= alertTotalPages - 1 ? 0.5 : 1,
                cursor: alertPage >= alertTotalPages - 1 ? 'not-allowed' : 'pointer'
              }}
            >
              Sau <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Modal Cấu hình tham số thiết bị (DeviceModal) theo yêu cầu báo cáo */}
      <DeviceModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        onSaveSuccess={(cfg) => setPumpConfig((prev) => ({ ...prev, ...cfg }))}
      />

    </div>
  );
}
