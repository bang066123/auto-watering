# HỆ THỐNG GIÁM SÁT & ĐIỀU KHIỂN TƯỚI THÔNG MINH

- **Nhóm thực hiện**: Nhóm 11
- **Thành viên**: Nguyễn Thanh Bằng (B23DCCN066), Bùi Quang Anh (B23DCCN010), Hoàng Mạnh Cường (B23DCCN108)
- **Kiến trúc hệ thống**: 
  - **Phần cứng (Firmware)**: 2 Node ESP32 (Node 1: Bộ điều khiển tưới & Node 2: Cảm biến mưa)
  - **Giao thức truyền thông**: MQTT Mosquitto Broker (Xác thực Username/Password)
  - **Backend**: Spring Boot 3.2.5 + Java 21 + Spring Data JPA + WebSocket STOMP
  - **Cơ sở dữ liệu**: MySQL 8.0 (Database: `iotv2_db`)
  - **Frontend**: React 19 + Vite + Recharts + Lucide Icons + StompJS

---

## 1. Sơ đồ phần cứng & Kết nối chân (Pinout)

### Khu vực 1: Bộ điều khiển tưới & cảm biến môi trường (`pump_controller.ino`)
| Thiết bị / Linh kiện | Chân ESP32 | Ghi chú kỹ thuật |
| :--- | :--- | :--- |
| **Cảm biến độ ẩm đất** | **D34** | Cảm biến điện dung (Capacitive), nguồn cấp **3.3V** |
| **Cảm biến DHT11** | **D14** | Đo nhiệt độ & độ ẩm không khí, nguồn 5V |
| **Động cơ Bơm nước** | **D25** | Điều khiển xung PWM (0 - 255) qua Transistor công suất TIP122, diode 1N4007 chống dòng ngược |
| **Đèn LED Wi-Fi** | **D2** | Báo trạng thái kết nối MQTT Broker (Sáng = Đã kết nối, Tắt = Mất kết nối) |
| **Nút bấm S7 (Bơm)** | **D32** | Nút nhấn vật lý Bật / Tắt máy bơm |
| **Nút bấm S2 (Chế độ)**| **D33** | Nút nhấn vật lý chuyển đổi AUTO / MANUAL |
| **Còi Buzzer** | **D26** | Kêu tiếng Beep khi nhận lệnh hoặc cảnh báo qua Transistor BC547 |
| **Đèn LED Chế độ** | **D15** | Báo chế độ vận hành (Sáng = AUTO, Tắt = MANUAL) |

### Khu vực 2: Node cảm biến mưa (`sketch_oct27a.ino`)
| Thiết bị / Linh kiện | Chân ESP32 | Ghi chú kỹ thuật |
| :--- | :--- | :--- |
| **Tín hiệu Cảm biến mưa (AO)** | **D34** | Đọc giá trị Analog ADC (0 - 4095) |
| **Nguồn VCC module mưa** | **3V3** | ⚠️ **QUAN TRỌNG**: Cấp nguồn từ chân `3V3` của ESP32 (Không cắm `VIN 5V` để bảo vệ chân ADC không bị quá áp) |
| **GND** | **GND** | Nối chung mass |

---

## 2. Logic vận hành nguyên bản của Code Arduino

1. **Thuật toán tưới ngắt quãng (Pulsed Irrigation)**:
   - Khi độ ẩm đất `< moistPerLow` (50%) và trời không mưa: Bắt đầu chu kỳ tưới.
   - Nhịp tưới thông minh: **Bơm 5 giây, nghỉ 10 giây** để nước kịp ngấm sâu vào đất và cảm biến đo chính xác.
   - Quá trình lặp lại cho đến khi độ ẩm đất đạt `>= moistPerHigh` (75%) thì tự động dừng bơm và gửi tổng kết chu kỳ (`sendCycleSummary`).

2. **Khóa an toàn khi trời mưa (`rainLevel >= 2`)**:
   - Nếu phát hiện mưa vừa hoặc to từ node cảm biến mưa (`rain/data`): Lập tức ngắt bơm và không tưới.

3. **Chế độ Thủ công (MANUAL)**:
   - Nút nhấn **S2** (`Pin 33`) hoặc điều khiển trên Web chuyển đổi qua lại giữa AUTO / MANUAL.
   - Nút nhấn **S7** (`Pin 32`) bật/tắt bơm thủ công trong chế độ MANUAL.

---

## 3. HƯỚNG DẪN THAY ĐỔI CẤU HÌNH KHI CHUYỂN QUA MÁY TÍNH KHÁC

Khi bạn chuyển toàn bộ project sang máy tính khác (hoặc đổi mạng Wi-Fi ở phòng lab, trường học), hãy thực hiện lần lượt các bước sau:

### Bước 1: Lấy địa chỉ IP máy tính mới
1. Mở cửa sổ **PowerShell** hoặc **CMD** trên máy tính mới.
2. Gõ lệnh:
   ```cmd
   ipconfig
   ```
3. Tìm dòng **IPv4 Address** của card mạng Wi-Fi (ví dụ: `192.168.1.15`).

---

### Bước 2: Cập nhật trong 2 file Arduino Code
Mở file `pump_controller.ino` và `sketch_oct27a.ino` bằng Arduino IDE:
1. Đổi tên & mật khẩu Wi-Fi sang mạng Wi-Fi của nơi bạn đang ngồi:
   ```cpp
   const char *ssid = "Ten_Wifi_Moi";
   const char *password = "Mat_Khau_Wifi_Moi";
   ```
2. Đổi địa chỉ `mqtt_broker` thành địa chỉ IPv4 máy tính bạn vừa lấy ở Bước 1:
   ```cpp
   const char *mqtt_broker = "192.168.1.15"; // Điền đúng IP máy tính mới
   const int mqtt_port = 1884;               // Cổng MQTT Broker (1884)
   ```
3. Thông tin xác thực MQTT giữ nguyên:
   ```cpp
   const char *mqtt_username = "nhom11";
   const char *mqtt_password = "B23DCCN066";
   ```
4. Cắm cáp USB và Nạp (Upload) code vào 2 board ESP32.

---

### Bước 3: Cấu hình Mosquitto Broker trên máy mới
1. Cài đặt **Eclipse Mosquitto** trên máy tính mới (tải tại: https://mosquitto.org/download/).
2. Mở file cấu hình `mosquitto.conf` (thường ở `C:\Program Files\mosquitto\mosquitto.conf` hoặc thư mục cấu hình của bạn):
   ```conf
   listener 1883 0.0.0.0
   allow_anonymous false
   password_file C:\mosquitto\passwd.txt
   ```
3. Tạo tài khoản đăng nhập bằng lệnh:
   ```cmd
   mosquitto_passwd -c "C:\mosquitto\passwd.txt" nhom11
   # Nhập mật khẩu: B23DCCN066
   ```
4. Khởi động Broker Mosquitto:
   ```cmd
   mosquitto -c "C:\mosquitto\mosquitto.conf" -v
   ```

---

### Bước 4: Cấu hình Cơ sở dữ liệu MySQL trên máy mới
1. Mở **MySQL Workbench** hoặc **CMD MySQL**:
2. Chạy câu lệnh tạo Database mới:
   ```sql
   CREATE DATABASE IF NOT EXISTS iotv2_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
3. Nếu mật khẩu tài khoản `root` của MySQL trên máy mới khác mật khẩu cũ, hãy mở file:
   [`backend/src/main/resources/application.yml`](backend/src/main/resources/application.yml)
   và sửa lại thông tin tài khoản MySQL:
   ```yaml
   spring:
     datasource:
       url: jdbc:mysql://127.0.0.1:3306/iotv2_db?useSSL=false&serverTimezone=Asia/Ho_Chi_Minh&allowPublicKeyRetrieval=true&characterEncoding=UTF-8&useUnicode=true
       username: root
       password: Mat_Khau_MySQL_May_Moi
   ```

---

### Bước 5: Khởi động toàn bộ hệ thống Web

#### 👉 Cách 1: Khởi động nhanh 1-Click (Khuyên dùng)
Bạn chỉ cần nhấp đúp chuột vào file:
👉 **`start_all.bat`** (nằm ngay tại thư mục `d:\IOTv2\start_all.bat` hoặc `d:\IOTv2\IOTv2\start_all.bat`)
Script sẽ tự động bật đồng thời Mosquitto Broker, Backend Spring Boot và Frontend React Vite.

---

#### 👉 Cách 2: Khởi động thủ công bằng dòng lệnh CMD / PowerShell

**1. Khởi động Mosquitto Broker:**
```cmd
cd /d "C:\Program Files\mosquitto"
mosquitto -c "C:\mosquitto\mosquitto.conf" -v
```

**2. Khởi động Backend (Tự khởi động luôn cả Frontend):**
```cmd
cd /d d:\IOTv2\IOTv2\backend
mvnw.cmd spring-boot:run
```

**3. Khởi động riêng Frontend (Nếu cần chạy độc lập):**
```cmd
cd /d d:\IOTv2\IOTv2\frontend
npm run dev
```

---

### 🔑 Thông tin đăng nhập trang Web:
- **Địa chỉ truy cập**: `http://localhost:5173`
- **Tài khoản**: `admin`
- **Mật khẩu**: `admin` (hoặc `123456`)

---

### 🧪 Hướng dẫn chạy Test khi KHÔNG CÓ phần cứng ESP32:
Hệ thống tích hợp sẵn **Hardware Simulator** giả lập trọn vẹn 2 node ESP32:
1. **Bật giả lập trên giao diện**: Cuộn xuống bảng điều khiển phần cứng trên web và gạt nút **"Bật giả lập"** sang **ON**.
2. **Hoặc bật nhanh bằng lệnh**:
   ```cmd
   curl -X POST http://localhost:8080/api/simulator/toggle
   ```
   *Dữ liệu nhiệt độ, độ ẩm và cảm biến mưa sẽ tự động nhảy số liên tục mỗi 3 giây lên biểu đồ mà không cần cắm mạch thật.*

---

## 4. Danh sách các MQTT Topics
- `nhom11/sensor/telemetry`: ESP32 đẩy định kỳ dữ liệu nhiệt độ, độ ẩm không khí, độ ẩm đất, trạng thái bơm, chế độ và thông tin mưa.
- `nhom11/device/control`: Web gửi lệnh bật/tắt bơm (`action: ON/OFF`) hoặc đổi chế độ (`action: AUTO/MANUAL`).
- `nhom11/device/ack`: ESP32 phản hồi kết quả thực thi lệnh điều khiển.
- `rain/data`: ESP32 Cảm biến mưa gửi dữ liệu mưa sang ESP32 Điều khiển bơm và Backend.
