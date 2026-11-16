import React, { useState, useRef, useEffect } from 'react';
import { Calendar, X } from 'lucide-react';

// Giá trị trao đổi với trang cha dùng ĐÚNG thứ tự hiển thị trên bảng: 'HH dd/MM/yyyy'
// (bảng hiển thị 21:30:00 19/10/2026 - giờ trước, ngày sau)
const toIsoDate = (val) => {
  const m = String(val || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return '';
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
};

const toHourLabel = (val) => {
  const first = String(val || '').trim().split(' ')[0];
  if (!first || first.includes('/') || first.includes('-')) return '';
  const hh = first.split(':')[0];
  return /^\d{1,2}$/.test(hh) ? `${hh.padStart(2, '0')}:00` : '';
};

const buildValue = (isoDate, hourLabel) => {
  if (!isoDate) return '';
  const [y, mo, d] = isoDate.split('-');
  return `${hourLabel.slice(0, 2)} ${d}/${mo}/${y}`;
};

export default function TimeMilestonePicker({ value, onChange, onApply }) {
  const [isOpen, setIsOpen] = useState(false);
  const [datePart, setDatePart] = useState('');
  const [hourPart, setHourPart] = useState('00:00');

  const containerRef = useRef(null);
  const closeTimeoutRef = useRef(null);
  const isInteractingRef = useRef(false);

  useEffect(() => {
    if (value) {
      const iso = toIsoDate(value);
      const hour = toHourLabel(value);
      if (iso) setDatePart(iso);
      if (hour) setHourPart(hour);
    } else {
      setDatePart('');
      const currentHour = String(new Date().getHours()).padStart(2, '0');
      setHourPart(`${currentHour}:00`);
    }
  }, [value]);

  const hours = Array.from({ length: 24 }, (_, i) => {
    const hh = String(i).padStart(2, '0');
    return `${hh}:00`;
  });

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = setTimeout(() => {
      if (!isInteractingRef.current) {
        setIsOpen(false);
        if (value) {
          const iso = toIsoDate(value);
          const hour = toHourLabel(value);
          if (iso) setDatePart(iso);
          if (hour) setHourPart(hour);
        } else {
          setDatePart('');
          const currentHour = String(new Date().getHours()).padStart(2, '0');
          setHourPart(`${currentHour}:00`);
        }
      }
    }, 350);
  };

  const handleFocus = () => {
    isInteractingRef.current = true;
  };

  const handleBlur = (e) => {
    if (containerRef.current && !containerRef.current.contains(e.relatedTarget)) {
      isInteractingRef.current = false;
      closeTimeoutRef.current = setTimeout(() => {
        setIsOpen(false);
      }, 250);
    }
  };

  const triggerChange = (newDate, newHour) => {
    if (!newDate) {
      onChange('');
      if (onApply) onApply('');
      return;
    }
    const val = buildValue(newDate, newHour);
    onChange(val);
    if (onApply) onApply(val);
  };

  const handleDateChange = (e) => {
    setDatePart(e.target.value);
  };

  const handleHourChange = (e) => {
    setHourPart(e.target.value);
  };

  const handleClear = (e) => {
    if (e) e.stopPropagation();
    setDatePart('');
    onChange('');
    if (onApply) onApply('');
    setIsOpen(false);
  };

  const formatButtonDisplay = (val) => {
    if (!val) return null;
    const iso = toIsoDate(val);
    const hour = toHourLabel(val);
    if (!iso || !hour) return val;
    const [y, mo, d] = iso.split('-');
    return `${hour} ${d}/${mo}/${y}`;
  };

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        title={value ? `Mốc thời gian: ${formatButtonDisplay(value)} (Di chuột để đổi)` : "Chọn mốc thời gian (Di chuột để mở)"}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: value ? '7px 12px' : '8px 12px',
          borderRadius: '8px',
          border: value ? '1.5px solid #3b82f6' : '1px solid var(--border)',
          backgroundColor: value ? '#eff6ff' : '#ffffff',
          color: value ? '#2563eb' : '#475569',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '0.85rem',
          transition: 'all 0.15s ease'
        }}
      >
        <Calendar size={16} />
        {value ? (
          <>
            <span style={{ fontSize: '0.82rem' }}>
              {formatButtonDisplay(value)}
            </span>
            <span
              onClick={handleClear}
              title="Xóa mốc thời gian"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2px',
                borderRadius: '50%',
                backgroundColor: '#dbeafe',
                color: '#1d4ed8',
                marginLeft: '2px',
                cursor: 'pointer'
              }}
            >
              <X size={12} />
            </span>
          </>
        ) : (
          <span style={{ fontSize: '0.82rem', color: '#64748b' }}>Mốc thời gian</span>
        )}
      </button>

      {isOpen && (
        <div
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            paddingTop: '6px',
            zIndex: 100,
            minWidth: '270px'
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '12px 14px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
                Mốc thời gian (Đến mức giờ)
              </span>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                Rê chuột ra ngoài để đóng
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', marginBottom: '2px' }}>
                  Ngày
                </label>
                <input
                  type="date"
                  value={datePart}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  onChange={handleDateChange}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    outline: 'none',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ width: '92px' }}>
                <label style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', marginBottom: '2px' }}>
                  Giờ
                </label>
                <select
                  value={hourPart}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  onChange={handleHourChange}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    backgroundColor: '#ffffff',
                    outline: 'none',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box'
                  }}
                >
                  {hours.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
              <button
                type="button"
                onClick={handleClear}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: '#ffffff',
                  color: '#64748b',
                  fontSize: '0.78rem',
                  cursor: 'pointer'
                }}
              >
                Xóa mốc
              </button>

              <button
                type="button"
                onClick={() => {
                  const effectiveDate = datePart || new Date().toLocaleDateString('en-CA');
                  if (!datePart) setDatePart(effectiveDate);
                  triggerChange(effectiveDate, hourPart);
                  setIsOpen(false);
                }}
                style={{
                  padding: '4px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#3b82f6',
                  color: '#ffffff',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Xong
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
