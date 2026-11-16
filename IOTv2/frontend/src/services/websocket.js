// ===================================================================
// FILE: src/services/websocket.js
// CHỨC NĂNG: Quản lý kết nối WebSocket thời gian thực (Real-time STOMP Client)
// Sử dụng thư viện @stomp/stompjs kết hợp SockJS fallback tới endpoint Spring Boot (/ws-iot)
// Áp dụng mô hình Observer / Pub-Sub pattern để phân phối dữ liệu cho các component React
// ===================================================================

import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

// [BLOCK 1: KHỞI TẠO LỚP WEBSOCKET CLIENT & DANH SÁCH SUBSCRIBERS]
class WebSocketClient {
  constructor() {
    this.client = null;
    this.connected = false;
    this._connecting = false;
    // Lưu trữ tập hợp các callback lắng nghe theo từng kênh (Topic)
    this.subscribers = {
      sensors: new Set(),
      devices: new Set(),
      history: new Set(),
      alerts: new Set(),
      status: new Set(),
      espStatus: new Set(),
      mqttStatus: new Set(),
    };
  }

  // [BLOCK 2: THIẾT LẬP KẾT NỐI STOMP QUA SOCKJS]
  connect() {
    // Nếu đã kết nối (hoặc đang trong quá trình kết nối) thì không tạo thêm client trùng lặp.
    // Cờ _connecting cần thiết vì React StrictMode gọi effect hai lần ở môi trường dev.
    if (this.client && (this.connected || this._connecting)) return;
    this._connecting = true;

    this.client = new Client({
      // SockJS Fallback: Đảm bảo tương thích với endpoint WebSocket của Spring Boot
      webSocketFactory: () => new SockJS('/ws-iot'),
      reconnectDelay: 3000,      // Tự động thử kết nối lại sau 3 giây nếu đứt mạng
      heartbeatIncoming: 4000,   // Kiểm tra tín hiệu giữ kết nối từ Server (4s)
      heartbeatOutgoing: 4000,   // Gửi tín hiệu giữ kết nối lên Server (4s)
      // [BLOCK 3: KHI KẾT NỐI THÀNH CÔNG VÀ ĐĂNG KÝ CÁC TOPIC]
      onConnect: () => {
        this._connecting = false;
        this.connected = true;
        this.notifyStatus(true);
        console.log('[WebSocket] Đã kết nối thành công tới máy chủ Auto Watering IoT');

        // 3.1. Kênh /topic/sensors & /topic/telemetry: Nhận thông số cảm biến thời gian thực
        const handleSensorMsg = (message) => {
          try {
            const data = JSON.parse(message.body);
            this.subscribers.sensors.forEach((callback) => callback(data));
          } catch (e) {
            console.error('Lỗi phân giải gói tin cảm biến/telemetry', e);
          }
        };
        this.client.subscribe('/topic/sensors', handleSensorMsg);
        this.client.subscribe('/topic/telemetry', handleSensorMsg);

        // 3.1B. Kênh /topic/rain: Cập nhật cảm biến mưa tức thời
        this.client.subscribe('/topic/rain', (message) => {
          try {
            const data = JSON.parse(message.body);
            this.subscribers.sensors.forEach((callback) =>
              callback({
                rain: data.rain,
                rainVal: data.value ?? data.rainVal,
                rainLevel: data.rainLevel,
              })
            );
          } catch (e) {
            console.error('Lỗi phân giải gói tin /topic/rain', e);
          }
        });

        // 3.2. Kênh /topic/devices: Nhận cập nhật trạng thái thiết bị (Bật/Tắt, PENDING, ACK)
        this.client.subscribe('/topic/devices', (message) => {
          try {
            const data = JSON.parse(message.body);
            this.subscribers.devices.forEach((callback) => callback(data));
          } catch (e) {
            console.error('Lỗi phân giải gói tin /topic/devices', e);
          }
        });

        // 3.2B. Kênh /topic/mode-sync: Đồng bộ chế độ AUTO / MANUAL tức thời
        this.client.subscribe('/topic/mode-sync', (message) => {
          try {
            const data = JSON.parse(message.body);
            const isAuto = String(data.mode).toUpperCase() === 'AUTO';
            this.subscribers.devices.forEach((callback) =>
              callback({
                type: 'MODE',
                action: isAuto ? 'AUTO' : 'MANUAL',
                isActive: isAuto,
                status: 'SUCCESS',
              })
            );
          } catch (e) {
            console.error('Lỗi phân giải gói tin /topic/mode-sync', e);
          }
        });

        // 3.2C. Kênh /topic/device-ack: Phản hồi danh sách thiết bị sau ACK
        this.client.subscribe('/topic/device-ack', (message) => {
          try {
            const list = JSON.parse(message.body);
            if (Array.isArray(list)) {
              list.forEach((dev) => {
                this.subscribers.devices.forEach((callback) =>
                  callback({
                    deviceId: dev.id,
                    id: dev.id,
                    type: dev.type,
                    isActive: dev.isActive,
                    status: 'SUCCESS',
                  })
                );
              });
            }
          } catch (e) {
            console.error('Lỗi phân giải gói tin /topic/device-ack', e);
          }
        });

        // 3.3. Kênh /topic/history & /topic/history-update: Nhận thông báo có bản ghi lịch sử điều khiển mới
        const handleHistoryMsg = (message) => {
          try {
            const data = JSON.parse(message.body);
            this.subscribers.history.forEach((callback) => callback(data));
          } catch (e) {
            console.error('Lỗi phân giải gói tin lịch sử', e);
          }
        };
        this.client.subscribe('/topic/history', handleHistoryMsg);
        this.client.subscribe('/topic/history-update', handleHistoryMsg);

        // 3.3B. Kênh /topic/alerts: Nhận từng lượt cảnh báo môi trường của Dashboard 2
        //       (khí gas / bụi / tiếng ồn vượt mức 50%)
        this.client.subscribe('/topic/alerts', (message) => {
          try {
            const data = JSON.parse(message.body);
            this.subscribers.alerts.forEach((callback) => callback(data));
          } catch (e) {
            console.error('Lỗi phân giải gói tin /topic/alerts', e);
          }
        });

        // 3.4. Kênh /topic/esp-status: Nhận trạng thái online/offline và ping của ESP8266
        this.client.subscribe('/topic/esp-status', (message) => {
          try {
            const data = JSON.parse(message.body);
            this.subscribers.espStatus.forEach((callback) => callback(data));
          } catch (e) {
            console.error('Lỗi phân giải gói tin /topic/esp-status', e);
          }
        });

        // 3.5. Kênh /topic/mqtt-status: Nhận trạng thái kết nối MQTT Broker
        this.client.subscribe('/topic/mqtt-status', (message) => {
          try {
            const data = JSON.parse(message.body);
            this.subscribers.mqttStatus.forEach((callback) => callback(data));
          } catch (e) {
            console.error('Lỗi phân giải gói tin /topic/mqtt-status', e);
          }
        });
      },

      // [BLOCK 4: XỬ LÝ KHI MẤT KẾT NỐI HOẶC CÓ LỖI XẢY RA]
      onDisconnect: () => {
        this.connected = false;
        this.notifyStatus(false);
        console.warn('[WebSocket] Mất kết nối tới máy chủ');
      },
      onStompError: (frame) => {
        this.connected = false;
        this.notifyStatus(false);
        console.error('[WebSocket] STOMP Error:', frame.headers['message'], frame.body);
      },
      onWebSocketClose: () => {
        this._connecting = false;
        this.connected = false;
        this.notifyStatus(false);
      },
    });

    // Kích hoạt tiến trình kết nối socket
    this.client.activate();
  }

  // [BLOCK 5: NGẮT KẾT NỐI CHỦ ĐỘNG]
  disconnect() {
    if (this.client) {
      this.client.deactivate();
      this.connected = false;
      this._connecting = false;
      this.notifyStatus(false);
    }
  }

  // Thông báo trạng thái mạng cho toàn bộ các listener quan sát
  notifyStatus(status) {
    this.subscribers.status.forEach((cb) => cb(status));
  }

  // [BLOCK 6: CÁC HÀM ĐĂNG KÝ LẮNG NGHE (PUB/SUB HOOKS CHO REACT)]
  // Component gọi hàm này sẽ nhận dữ liệu và hàm trả về unsubscribe để cleanup
  onSensorData(callback) {
    this.subscribers.sensors.add(callback);
    return () => this.subscribers.sensors.delete(callback);
  }

  onDeviceStatus(callback) {
    this.subscribers.devices.add(callback);
    return () => this.subscribers.devices.delete(callback);
  }

  onHistoryUpdate(callback) {
    this.subscribers.history.add(callback);
    return () => this.subscribers.history.delete(callback);
  }

  // Lắng nghe cảnh báo môi trường (Dashboard 2)
  onAlert(callback) {
    this.subscribers.alerts.add(callback);
    return () => this.subscribers.alerts.delete(callback);
  }

  onConnectionChange(callback) {
    this.subscribers.status.add(callback);
    callback(this.connected);
    return () => this.subscribers.status.delete(callback);
  }

  onEspStatus(callback) {
    this.subscribers.espStatus.add(callback);
    return () => this.subscribers.espStatus.delete(callback);
  }

  onMqttStatus(callback) {
    this.subscribers.mqttStatus.add(callback);
    return () => this.subscribers.mqttStatus.delete(callback);
  }
}

// [BLOCK 7: XUẤT ĐỐI TƯỢNG DUY NHẤT (SINGLETON INSTANCE)]
const wsClient = new WebSocketClient();
export default wsClient;

