// ===================================================================
// FILE: src/services/api.js
// CHỨC NĂNG: Tầng giao tiếp HTTP REST API (Sử dụng Axios)
// Đảm nhiệm: Gửi request tới Backend Spring Boot, cấu hình Interceptor cho JWT Token
// và định nghĩa tất cả các endpoint API của dự án
// ===================================================================

import axios from 'axios';

// [BLOCK 1: KHỞI TẠO ĐỐI TƯỢNG AXIOS INSTANCE]
// Cấu hình tiền tố đường dẫn mặc định (/api) và định dạng dữ liệu JSON
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// [BLOCK 2: AXIOS REQUEST INTERCEPTOR - ĐÍNH KÈM TOKEN XÁC THỰC]
// Trước khi mỗi request được gửi đi, tự động lấy token từ localStorage
// và gắn vào header Authorization theo chuẩn Bearer Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('smartroom_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// [BLOCK 3: AXIOS RESPONSE INTERCEPTOR - XỬ LÝ LỖI HẾT HẠN PHIÊN 401]
// Khi Backend trả về lỗi 401 Unauthorized (do token sai hoặc hết hạn),
// tự động dọn dẹp bộ nhớ phiên và chuyển hướng người dùng về trang đăng nhập
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('smartroom_token');
      localStorage.removeItem('smartroom_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// [BLOCK 4: CÁC API XÁC THỰC & HỒ SƠ CÁ NHÂN (authApi)]
export const authApi = {
  // Gửi thông tin đăng nhập (email, password) -> Nhận về JWT Token
  login: async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    return res.data;
  },
  // Lấy dữ liệu hồ sơ sinh viên / quản trị viên hiện tại
  getProfile: async () => {
    const res = await api.get('/profile');
    return res.data;
  },
  // Cập nhật thông tin hồ sơ sinh viên (họ tên, mã sinh viên, email, lớp)
  updateProfile: async (data) => {
    const res = await api.put('/profile', data);
    return res.data;
  },
};

// [BLOCK 5: CÁC API QUẢN LÝ VÀ ĐIỀU KHIỂN THIẾT BỊ (deviceApi)]
export const deviceApi = {
  // Lấy danh sách toàn bộ thiết bị phòng (Đèn 1, Đèn 2, Đèn 3, Relay...)
  getAll: async () => {
    const res = await api.get('/devices');
    return res.data;
  },
  // Lấy trạng thái hoạt động mới nhất của các thiết bị
  getStatus: async () => {
    const res = await api.get('/devices/status');
    return res.data;
  },
  // Thêm mới một thiết bị vào hệ thống
  create: async (data) => {
    const res = await api.post('/devices', data);
    return res.data;
  },
  // Chỉnh sửa thông tin thiết bị (tên, phân loại)
  update: async (id, data) => {
    const res = await api.put(`/devices/${id}`, data);
    return res.data;
  },
  // Xóa thiết bị khỏi hệ thống
  delete: async (id) => {
    const res = await api.delete(`/devices/${id}`);
    return res.data;
  },
  // Điều khiển BẬT (ON) hoặc TẮT (OFF) thiết bị theo ID
  control: async (id, action) => {
    const res = await api.post(`/devices/${id}/control`, { action });
    return res.data;
  },
  // Gửi gói tin xác nhận ACK từ phần cứng phản hồi lại máy chủ
  sendAck: async (id, action, status = 'SUCCESS', historyId = null) => {
    const res = await api.post(`/devices/${id}/ack`, { action, status, historyId });
    return res.data;
  },
};

// [BLOCK 6: CÁC API DỮ LIỆU ĐO LƯỜNG CẢM BIẾN (sensorApi)]
export const sensorApi = {
  // Lấy danh mục các loại cảm biến trong phòng
  getAll: async () => {
    const res = await api.get('/sensors');
    return res.data;
  },
  // Lấy giá trị đo lường mới nhất của Nhiệt độ, Độ ẩm, Ánh sáng
  getLatest: async () => {
    const res = await api.get('/sensors/latest');
    return res.data;
  },
  // Lấy danh sách các mốc gần nhất phục vụ vẽ biểu đồ (Chart)
  getRecentChart: async () => {
    const res = await api.get('/sensors/chart');
    return res.data;
  },
  // Tra cứu dữ liệu cảm biến có phân trang, lọc theo loại, giá trị, thời gian
  getDataSensors: async (params = {}) => {
    const res = await api.get('/datasensor', { params });
    return res.data;
  },
};

// [BLOCK 6B: CÁC API CẢNH BÁO MÔI TRƯỜNG - DASHBOARD 2 (alertApi)]
export const alertApi = {
  // Danh sách lượt cảnh báo, có phân trang và lọc theo loại / mốc thời gian
  // params: { type: 'gas' | 'dust' | 'sound', from, to, page, size }
  getAll: async (params = {}) => {
    const res = await api.get('/alerts', { params });
    return res.data;
  },
  // Số lượt cảnh báo hôm nay: { date, total, byType: { gas, dust, sound }, threshold }
  getTodayCount: async () => {
    const res = await api.get('/alerts/today-count');
    return res.data;
  },
  // Thống kê số lượt cảnh báo theo từng ngày của N ngày gần nhất
  getDaily: async (days = 7) => {
    const res = await api.get('/alerts/daily', { params: { days } });
    return res.data;
  },
};

// [BLOCK 7: CÁC API NHẬT KÝ ĐIỀU KHIỂN (historyApi)]
export const historyApi = {
  // Tra cứu lịch sử thao tác bật/tắt thiết bị có phân trang và bộ lọc đa tiêu chí
  getAll: async (params = {}) => {
    const res = await api.get('/history', { params });
    return res.data;
  },
};

// [BLOCK 9: CÁC API TRẠNG THÁI VI ĐIỀU KHIỂN ESP8266 (espApi)]
export const espApi = {
  // Kiểm tra vi điều khiển ESP8266 có đang online và đo chỉ số Ping ms
  getStatus: async () => {
    const res = await api.get('/esp/status');
    return res.data;
  },
  // Cập nhật cấu hình Wi-Fi / IP cho vi điều khiển
  updateConfig: async (data) => {
    const res = await api.post('/esp/config', data);
    return res.data;
  },
};

// [BLOCK 10: CÁC API KẾT NỐI MQTT BROKER (mqttApi)]
export const mqttApi = {
  // Kiểm tra kết nối tới Mosquitto / HiveMQ Broker
  getStatus: async () => {
    const res = await api.get('/mqtt/status');
    return res.data;
  },
  // Yêu cầu máy chủ kết nối lại tới MQTT Broker
  reconnect: async () => {
    const res = await api.post('/mqtt/connect');
    return res.data;
  },
};

export default api;

