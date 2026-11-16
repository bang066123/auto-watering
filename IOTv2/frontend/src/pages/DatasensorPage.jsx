import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  Thermometer, 
  Droplets, 
  CloudRain,
  Sprout,
  Calendar,
  X
} from 'lucide-react';
import { sensorApi } from '../services/index';
import wsClient from '../services/wsIndex';
import { parseVnTimeRange, TIME_FORMAT_HINT, TIME_FORMAT_PLACEHOLDER } from '../utils/timeRange';

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100];

export default function DatasensorPage() {
  const [dataList, setDataList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newIds, setNewIds] = useState(() => new Set());
  const newIdsTimer = useRef(null);
  const listRef = useRef([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);

  // Bộ lọc
  const [type, setType] = useState('');
  const [from, setFrom] = useState('');
  const [timeError, setTimeError] = useState('');

  // Giữ bộ lọc và trang hiện tại để callback WebSocket không đọc giá trị cũ
  const liveFilterRef = useRef({ from: '', page: 0 });
  const [searchValue, setSearchValue] = useState('');

  // silent = true: làm mới ngầm khi có dữ liệu thời gian thực,
  // không bật cờ loading nên bảng không bị chớp trắng
  const fetchData = async (currentPage = page, overrideFilters = null, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const activeType = overrideFilters && overrideFilters.type !== undefined ? overrideFilters.type : type;
      const activeFrom = overrideFilters && overrideFilters.from !== undefined ? overrideFilters.from : from;
      const activeSearchValue = overrideFilters && overrideFilters.searchValue !== undefined ? overrideFilters.searchValue : searchValue;
      
      // Tìm kiếm theo khoảng giá trị đo
      let activeMin = null;
      let activeMax = null;
      if (activeSearchValue) {
        const numStr = String(activeSearchValue).trim();
        if (numStr !== '') {
          activeMin = numStr;
          activeMax = numStr.includes('.') ? numStr + "999" : numStr + ".999";
        }
      }

      const activeSize = overrideFilters && overrideFilters.size !== undefined ? overrideFilters.size : size;

      const params = {
        page: currentPage,
        size: activeSize,
      };
      if (activeSearchValue) params.search = activeSearchValue;
      if (activeType) params.type = activeType;
      if (activeMin) params.minValue = activeMin;
      if (activeMax) params.maxValue = activeMax;
      
      // Chuẩn hóa mốc thời gian lọc theo đúng định dạng hiển thị ở cột "Thời Gian Ghi Nhận"
      // (dd/MM/yyyy, HH:mm:ss) - xem src/utils/timeRange.js
      if (activeFrom && activeFrom.trim()) {
        const range = parseVnTimeRange(activeFrom);
        if (!range) {
          setTimeError(TIME_FORMAT_HINT);
          return;
        }
        params.from = range.from;
        params.to = range.to;
        setTimeError('');
      } else {
        setTimeError('');
      }

      const res = await sensorApi.getDataSensors(params);
      const nextList = res.content || [];

      // So với danh sách đang hiển thị để biết dòng nào vừa xuất hiện,
      // chỉ đánh dấu khi làm mới ngầm (có dữ liệu realtime đẩy về)
      if (silent) {
        const oldIds = new Set(listRef.current.map((x) => x.id));
        const added = nextList.filter((x) => !oldIds.has(x.id)).map((x) => x.id);
        if (added.length > 0) {
          setNewIds(new Set(added));
          clearTimeout(newIdsTimer.current);
          newIdsTimer.current = setTimeout(() => setNewIds(new Set()), 1200);
        }
      }
      setDataList(nextList);
      setTotalPages(res.totalPages || 1);
      setTotalElements(res.totalElements || 0);
      setPage(res.number || 0);
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu cảm biến', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Đồng bộ danh sách đang hiển thị vào ref sau mỗi lần render
  useEffect(() => {
    listRef.current = dataList;
  }, [dataList]);

  // Đồng bộ bộ lọc hiện tại vào ref sau mỗi lần render
  useEffect(() => {
    liveFilterRef.current = { from, page };
  }, [from, page]);

  useEffect(() => {
    fetchData(0);

    // Mỗi gói telemetry mới từ ESP8266 -> nạp lại bảng để thấy bản ghi vừa ghi nhận.
    // Chỉ tự cập nhật khi đang ở trang 1 và không lọc theo mốc thời gian,
    // tránh giật bảng khi người dùng đang tra cứu một khoảng cụ thể.
    const unsub = wsClient.onSensorData(() => {
      const { from: currentFrom, page: currentPage } = liveFilterRef.current;
      if (currentFrom || currentPage !== 0) return;
      fetchData(0, null, true);
    });

    return () => unsub();
  }, [type, size, searchValue]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchData(0);
  };

  const handleReset = () => {
    setType('');
    setFrom('');
    setTimeError('');
    setSearchValue('');
    fetchData(0, { type: '', from: '', searchValue: '' });
  };

  const cleanSensorName = (sensor) => {
    if (!sensor) return 'Cảm biến';
    const name = sensor.name || '';
    if (name.toLowerCase().includes('nhiệt') || sensor.sensorType === 'temperature') return 'Nhiệt độ';
    if (name.toLowerCase().includes('đất') || sensor.sensorType === 'soil_moisture') return 'Độ ẩm đất';
    if (name.toLowerCase().includes('mưa') || sensor.sensorType === 'rain') return 'Cảm biến mưa';
    if (name.toLowerCase().includes('ẩm') || sensor.sensorType === 'humidity') return 'Độ ẩm không khí';
    return name.replace(/\s*\(.*?\)/g, '').replace(/^.*-\s*/, '').trim();
  };

  const formatSensorType = (sensor) => {
    const rawType = (sensor?.sensorType || '').toLowerCase();
    if (rawType.includes('temp') || rawType.includes('nhiệt')) {
      return (
        <span className="badge" style={{ backgroundColor: '#fff7ed', color: '#c2410c', border: '1px solid #ffedd5' }}>
          <Thermometer size={13} /> Nhiệt độ
        </span>
      );
    }
    if (rawType.includes('soil') || rawType.includes('đất')) {
      return (
        <span className="badge" style={{ backgroundColor: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
          <Sprout size={13} /> Độ ẩm đất
        </span>
      );
    }
    if (rawType.includes('rain') || rawType.includes('mưa')) {
      return (
        <span className="badge" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
          <CloudRain size={13} /> Cảm biến mưa
        </span>
      );
    }
    if (rawType.includes('hum') || rawType.includes('ẩm')) {
      return (
        <span className="badge badge-info">
          <Droplets size={13} /> Độ ẩm KK
        </span>
      );
    }
    return <span className="badge">{rawType.toUpperCase()}</span>;
  };

  const formatUnit = (sensor) => {
    const rawType = (sensor?.sensorType || '').toLowerCase();
    if (rawType.includes('temp') || rawType.includes('nhiệt')) return '°C';
    if (rawType.includes('soil') || rawType.includes('hum') || rawType.includes('ẩm')) return '%';
    return '';
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      height: '100%',
      overflowY: 'auto',
      overflowX: 'hidden',
      paddingRight: '4px',
      paddingBottom: '8px'
    }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
            Tra cứu dữ liệu đo lường cảm biến (Datasensor)
          </h2>
          <p style={{ fontSize: '0.82rem', color: '#64748b' }}>
            Tổng số bản ghi: <strong>{totalElements}</strong> ({size} bản ghi/trang) • Trang <strong>{page + 1}</strong> / <strong>{Math.max(totalPages, 1)}</strong>
          </p>
        </div>

        <button 
          onClick={() => fetchData(page)} 
          className="btn btn-secondary"
          style={{ padding: '7px 14px', fontSize: '0.85rem' }}
        >
          <RefreshCw size={15} /> Làm mới bảng
        </button>
      </div>

      {/* Filter toolbar */}
      <div className="card" style={{ padding: '12px 20px' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              minWidth: '150px',
              height: '38px',
              backgroundColor: '#ffffff',
              outline: 'none',
              fontSize: '0.88rem'
            }}
          >
            <option value="">-- Tất cả cảm biến --</option>
            <option value="temperature">Nhiệt độ</option>
            <option value="humidity">Độ ẩm không khí</option>
            <option value="soil_moisture">Độ ẩm đất</option>
            <option value="rain">Cảm biến mưa</option>
          </select>

          <input
            type="number"
            step="any"
            placeholder="Nhập giá trị đo..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            style={{ height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--border)', width: '150px', outline: 'none', fontSize: '0.88rem', boxSizing: 'border-box' }}
          />

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: '1 1 200px', minWidth: '200px' }}>
            <Calendar size={16} color="#94a3b8" style={{ position: 'absolute', left: '10px', pointerEvents: 'none' }} />
            <input
              type="text"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder={TIME_FORMAT_PLACEHOLDER}
              style={{
                width: '100%',
                height: '38px',
                padding: '0 28px 0 32px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                backgroundColor: '#ffffff',
                fontSize: '0.88rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            {from && (
              <button
                type="button"
                onClick={() => {
                  setFrom('');
                  setTimeError('');
                  fetchData(0, { from: '' });
                }}
                style={{
                  position: 'absolute',
                  right: '8px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="Xóa mốc thời gian"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {timeError && (
            <span style={{ flexBasis: '100%', color: '#b91c1c', fontSize: '0.8rem', fontWeight: 500 }}>
              {timeError}
            </span>
          )}

          <select
            value={size}
            onChange={(e) => {
              const newSize = Number(e.target.value);
              setSize(newSize);
              fetchData(0, { size: newSize });
            }}
            title="Số dòng hiển thị mỗi trang"
            style={{ height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#ffffff', fontSize: '0.88rem', outline: 'none', cursor: 'pointer' }}
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n} dòng/trang</option>
            ))}
          </select>

          <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
            <button type="submit" className="btn btn-primary" style={{ height: '38px', padding: '0 16px' }}>
              <Search size={15} /> Lọc
            </button>
            <button type="button" onClick={handleReset} className="btn btn-secondary" style={{ height: '38px', padding: '0 14px' }}>
              Đặt lại
            </button>
          </div>
        </form>
      </div>

      {/* Table */}
      {/* flexShrink: 0 để bảng giữ nguyên chiều cao thật, trang cuộn thay vì bảng tự cuộn bên trong */}
      <div className="table-container" style={{ flexShrink: 0 }}>
        <table className="custom-table">
          <thead>
            <tr>
              <th style={{ width: '80px' }}>ID</th>
              <th>Tên Cảm Biến</th>
              <th>Loại Thông Số</th>
              <th>Giá Trị Đo</th>
              <th>Thời Gian Ghi Nhận</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                  Đang tải dữ liệu cảm biến...
                </td>
              </tr>
            ) : dataList.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                  Không tìm thấy bản ghi dữ liệu cảm biến nào phù hợp điều kiện lọc.
                </td>
              </tr>
            ) : (
              dataList.map((item) => (
                <tr key={item.id} className={newIds.has(item.id) ? 'row-new' : undefined}>
                  <td style={{ fontWeight: 600, color: '#64748b' }}>#{item.id}</td>
                  <td style={{ fontWeight: 500 }}>{cleanSensorName(item.sensor)}</td>
                  <td>{formatSensorType(item.sensor)}</td>
                  <td style={{ fontSize: '1.02rem', fontWeight: 700, color: '#0f172a' }}>
                    {item.value} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#64748b' }}>{formatUnit(item.sensor)}</span>
                  </td>
                  <td style={{ color: '#475569', fontSize: '0.88rem' }}>
                    {item.time ? new Date(item.time).toLocaleString('vi-VN') : '--'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
          Hiển thị <strong>{dataList.length > 0 ? page * size + 1 : 0}</strong> - <strong>{Math.min((page + 1) * size, totalElements)}</strong> trong tổng số <strong>{totalElements}</strong> bản ghi (Trang <strong>{page + 1}</strong> / <strong>{Math.max(totalPages, 1)}</strong>)
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => fetchData(page - 1)}
            disabled={page <= 0 || loading}
            className="btn btn-secondary"
            style={{ 
              padding: '6px 14px', 
              fontSize: '0.82rem',
              cursor: page <= 0 || loading ? 'not-allowed' : 'pointer',
              opacity: page <= 0 || loading ? 0.5 : 1
            }}
          >
            <ChevronLeft size={16} /> Trang trước
          </button>

          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', padding: '0 8px' }}>
            {page + 1} / {Math.max(totalPages, 1)}
          </span>

          <button
            onClick={() => fetchData(page + 1)}
            disabled={page >= totalPages - 1 || loading}
            className="btn btn-secondary"
            style={{ 
              padding: '6px 14px', 
              fontSize: '0.82rem',
              cursor: page >= totalPages - 1 || loading ? 'not-allowed' : 'pointer',
              opacity: page >= totalPages - 1 || loading ? 0.5 : 1
            }}
          >
            Trang sau <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}


