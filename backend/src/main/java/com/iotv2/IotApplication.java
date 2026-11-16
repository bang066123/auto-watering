package com.iotv2;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.net.Socket;

@SpringBootApplication
@EnableScheduling
@Slf4j
public class IotApplication {

    private static Process viteProcess;

    public static void main(String[] args) {
        System.setProperty("file.encoding", "UTF-8");
        System.setProperty("sun.stdout.encoding", "UTF-8");
        System.setProperty("sun.stderr.encoding", "UTF-8");

        log.info("==========================================================");
        log.info("   HỆ THỐNG GIÁM SÁT & ĐIỀU KHIỂN TƯỚI THÔNG MINH IOTV2   ");
        log.info("   Backend: Spring Boot 3.2.5 + Java 21 + MySQL + MQTT   ");
        log.info("==========================================================");

        // 1. Tự động khởi chạy Frontend (Vite Dev Server) song song
        startFrontendDevServer();

        // 2. Khởi chạy Backend Spring Boot
        SpringApplication.run(IotApplication.class, args);
    }

    /**
     * Khi Spring Boot khởi động hoàn tất:
     * - Thông báo các cổng kết nối
     * - Tự động bật trình duyệt web tới http://localhost:5173
     */
    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        log.info("----------------------------------------------------------");
        log.info(">> [OK] Backend Spring Boot đang chạy tại: http://localhost:8080");
        log.info(">> [OK] Frontend React (Vite) đang chạy tại: http://localhost:5173");
        log.info(
                ">> [OK] MQTT Topics: bqa/sensor/telemetry, bqa/device/control, bqa/device/ack, rain/data");
        log.info("----------------------------------------------------------");

        // Đợi 1.5s để Vite khởi động xong rồi tự động mở trình duyệt
        new Thread(() -> {
            try {
                Thread.sleep(1500);
            } catch (InterruptedException ignored) {
            }
            openBrowser("http://localhost:5173");
        }).start();
    }

    /**
     * Hàm tự động khởi chạy Frontend Vite (npm run dev)
     */
    private static void startFrontendDevServer() {
        int frontendPort = 5173;
        if (isPortInUse("localhost", frontendPort)) {
            log.info("[Frontend] Cổng {} đang hoạt động sẵn, bỏ qua bước khởi động lại.", frontendPort);
            return;
        }

        File frontendDir = findFrontendDirectory();
        if (frontendDir == null) {
            log.warn("[Frontend] Không tìm thấy thư mục 'frontend'. Hãy kiểm tra lại cấu trúc thư mục.");
            return;
        }

        log.info("[Frontend] Đã tìm thấy thư mục frontend: {}", frontendDir.getAbsolutePath());
        log.info("[Frontend] Đang thực thi lệnh: 'npm run dev'...");

        try {
            ProcessBuilder pb = new ProcessBuilder("cmd.exe", "/c", "npm run dev");
            pb.directory(frontendDir);
            pb.redirectErrorStream(true);

            viteProcess = pb.start();

            // Đọc log của Vite ở luồng riêng để tránh làm treo tiến trình
            Thread logThread = new Thread(() -> {
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(viteProcess.getInputStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        log.info("[Vite] {}", line);
                    }
                } catch (Exception ignored) {
                }
            }, "ViteLogThread");
            logThread.setDaemon(true);
            logThread.start();

            // Đăng ký Shutdown Hook: Tắt tiến trình Vite/Node khi người dùng dừng Spring
            // Boot
            Runtime.getRuntime().addShutdownHook(new Thread(() -> {
                if (viteProcess != null && viteProcess.isAlive()) {
                    log.info("[Frontend] Đang dừng tiến trình Vite...");
                    try {
                        long pid = viteProcess.pid();
                        new ProcessBuilder("taskkill", "/F", "/T", "/PID", String.valueOf(pid)).start().waitFor();
                    } catch (Exception e) {
                        viteProcess.destroyForcibly();
                    }
                }
            }));

        } catch (Exception e) {
            log.error("[Frontend] Lỗi khi tự động khởi chạy Frontend: {}", e.getMessage(), e);
        }
    }

    /**
     * Tự động dò tìm đường dẫn thư mục frontend dù chạy từ thư mục gốc hay thư mục backend
     */
    private static File findFrontendDirectory() {
        String[] possiblePaths = {
            "../frontend",
            "frontend",
            "../../frontend"
        };

        for (String path : possiblePaths) {
            File dir = new File(path);
            if (dir.exists() && dir.isDirectory() && new File(dir, "package.json").exists()) {
                return dir;
            }
        }
        return null;
    }

    /**
     * Kiểm tra cổng mạng xem đã có dịch vụ nào đang lắng nghe chưa
     */
    private static boolean isPortInUse(String host, int port) {
        try (Socket socket = new Socket(host, port)) {
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Mở trình duyệt mặc định trên hệ điều hành Windows
     */
    private static void openBrowser(String url) {
        try {
            log.info(">> Đang tự động mở trình duyệt web tới: {}", url);
            new ProcessBuilder("cmd.exe", "/c", "start", url).start();
        } catch (Exception e) {
            log.warn("Không thể tự động mở trình duyệt: {}", e.getMessage());
        }
    }
}
