import React, { useState, useEffect } from 'react';
import { X, User, Mail, GraduationCap, School, ShieldCheck, Edit3, Check, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ProfileModal({ isOpen, onClose }) {
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    studentId: '',
    className: '',
    email: '',
    school: 'Học viện Công nghệ Bưu chính Viễn thông',
  });
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Chỉ khởi tạo formData một lần khi người dùng mở modal
  useEffect(() => {
    if (!isOpen) {
      setIsEditing(false);
      setSaveError('');
      setSavedSuccess(false);
      return;
    }

    if (user) {
      setFormData({
        name: user.name || 'Nguyễn Thanh Bằng',
        studentId: user.studentId || 'B23DCCN066',
        className: user.className || '',
        email: user.email || 'thanhbang@ptit.edu.vn',
        school: user.school || 'Học viện Công nghệ Bưu chính Viễn thông',
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveError('');
    try {
      const payload = {
        name: (formData.name || '').trim(),
        studentId: (formData.studentId || '').trim(),
        className: (formData.className || '').trim(),
        email: (formData.email || '').trim(),
      };

      if (updateUser) {
        const next = await updateUser(payload);
        if (next) {
          setFormData({
            name: next.name || '',
            studentId: next.studentId || '',
            className: next.className || '',
            email: next.email || '',
            school: next.school || 'Học viện Công nghệ Bưu chính Viễn thông',
          });
        }
      }
      setSavedSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      console.error('Lỗi cập nhật hồ sơ', err);
      setSaveError('Không lưu được hồ sơ lên máy chủ. Vui lòng thử lại.');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>

        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={20} color="var(--primary)" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#0f172a' }}>Hồ sơ Quản trị viên</h3>
          </div>
          <button onClick={onClose} style={{ color: '#64748b', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 20px' }}>

          {/* Avatar & Thông tin cơ bản */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: '#eff6ff',
              border: '2px solid #bfdbfe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#2563eb',
              fontSize: '1.5rem',
              fontWeight: 700
            }}>
              MP
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                {formData.name || 'Bùi Quang Anh'}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <span className="badge badge-success">
                  <ShieldCheck size={12} /> Quản trị viên (Admin)
                </span>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  {formData.studentId || 'B23DCCN010'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <Edit3 size={13} />
              {isEditing ? 'Hủy sửa' : 'Sửa'}
            </button>
          </div>

          {saveError && (
            <div style={{
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              fontSize: '0.85rem',
              fontWeight: 500,
              marginBottom: '14px'
            }}>
              {saveError}
            </div>
          )}

          {savedSuccess && (
            <div style={{
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#065f46',
              fontSize: '0.85rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '14px'
            }}>
              <Check size={15} /> Đã cập nhật và lưu thông tin thành công!
            </div>
          )}

          {isEditing ? (
            /* Form chỉnh sửa */
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                  HỌ VÀ TÊN
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                    MÃ SINH VIÊN
                  </label>
                  <input
                    type="text"
                    value={formData.studentId}
                    onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      fontSize: '0.9rem',
                      outline: 'none'
                    }}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                    LỚP HỌC
                  </label>
                  <input
                    type="text"
                    value={formData.className}
                    onChange={(e) => setFormData({ ...formData, className: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      fontSize: '0.9rem',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                  EMAIL LIÊN HỆ
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    if (user) {
                      setFormData({
                        name: user.name || 'Nguyễn Thanh Bằng',
                        studentId: user.studentId || 'B23DCCN066',
                        className: user.className || '',
                        email: user.email || 'thanhbang@ptit.edu.vn',
                        school: user.school || 'Học viện Công nghệ Bưu chính Viễn thông',
                      });
                    }
                  }}
                  className="btn btn-secondary"
                  style={{ padding: '7px 14px', fontSize: '0.85rem' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '7px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Save size={14} /> Lưu thay đổi
                </button>
              </div>
            </form>
          ) : (
            /* Hiển thị thông tin */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px' }}>
                <School size={18} color="#64748b" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Cơ sở đào tạo</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 500, color: '#1e293b' }}>{formData.school}</div>
                </div>
              </div>

              {formData.className ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px' }}>
                  <GraduationCap size={18} color="#64748b" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Lớp học</div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 500, color: '#1e293b' }}>{formData.className}</div>
                  </div>
                </div>
              ) : null}

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px' }}>
                <Mail size={18} color="#64748b" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Email liên hệ</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 500, color: '#1e293b' }}>{formData.email}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border)',
          background: '#f8fafc',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '0.88rem' }}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
