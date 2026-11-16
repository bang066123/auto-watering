import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../services/index';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('smartroom_token'));
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('smartroom_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  const logout = () => {
    localStorage.removeItem('smartroom_token');
    localStorage.removeItem('smartroom_user');
    setToken(null);
    setUser(null);
  };

  // Tự động kiểm tra token khi vào trang
  useEffect(() => {
    const verifyAuth = async () => {
      if (token) {
        try {
          const profile = await authApi.getProfile();
          setUser(profile);
          localStorage.setItem('smartroom_user', JSON.stringify(profile));
        } catch (err) {
          if (err.response && (err.response.status === 401 || err.response.status === 403)) {
            console.warn('Xác thực token thất bại, vui lòng đăng nhập lại', err);
            logout();
          } else {
            console.warn('Backend chưa sẵn sàng hoặc gặp sự cố mạng, tạm giữ phiên đăng nhập', err);
          }
        }
      }
      setLoading(false);
    };
    verifyAuth();
  }, [token]);

  const login = async (email, password) => {
    const res = await authApi.login(email, password);
    const jwtToken = res.token;

    localStorage.setItem('smartroom_token', jwtToken);
    setToken(jwtToken);

    const userData = {
      id: res.id,
      name: res.name,
      email: res.email,
      studentId: res.studentId,
      className: res.className,
      avatar: res.avatar,
      linkFigma: res.linkFigma || '',
      linkGithub: res.linkGithub || '',
      linkPostman: res.linkPostman || '',
      linkReport: res.linkReport || '',
    };
    setUser(userData);
    localStorage.setItem('smartroom_user', JSON.stringify(userData));
    return userData;
  };

  const refreshProfile = async () => {
    try {
      const profile = await authApi.getProfile();
      setUser(profile);
      localStorage.setItem('smartroom_user', JSON.stringify(profile));
      return profile;
    } catch (e) {
      console.error('Không thể làm mới hồ sơ', e);
    }
  };

  const updateUser = async (data) => {
    // Không tự ý coi là thành công khi máy chủ trả lỗi - để giao diện báo cho người dùng
    const updated = await authApi.updateProfile(data);
    const nextUser = { ...user, ...updated };
    setUser(nextUser);
    localStorage.setItem('smartroom_user', JSON.stringify(nextUser));
    return nextUser;
  };

  return (
    <AuthContext.Provider value={{
      token,
      user,
      login,
      logout,
      refreshProfile,
      updateUser,
      isAuthenticated: !!token,
      loading
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
