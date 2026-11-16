// ===================================================================
// FILE: src/services/index.js
// CHỨC NĂNG: Tầng điều phối dữ liệu (Barrel Export)
// Kết nối trực tiếp tới Backend Spring Boot qua Axios REST API
// ===================================================================

import api, {
  authApi,
  deviceApi,
  sensorApi,
  alertApi,
  historyApi,
  espApi,
  mqttApi,
} from './api';

export {
  authApi,
  deviceApi,
  sensorApi,
  alertApi,
  historyApi,
  espApi,
  mqttApi,
};

export default api;
