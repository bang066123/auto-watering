package com.iotv2.controller;

import com.iotv2.model.User;
import com.iotv2.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@Slf4j
public class AuthController {

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @PostMapping("/auth/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> request) {
        String inputAccount = request.get("email");
        String inputPassword = request.get("password");

        if (inputAccount == null || inputAccount.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Vui lòng nhập tài khoản hoặc email"));
        }

        // Hỗ trợ đăng nhập trực tiếp bằng tài khoản admin chung
        if ("admin".equalsIgnoreCase(inputAccount) && ("admin".equals(inputPassword) || "123456".equals(inputPassword)
                || "admin123".equals(inputPassword))) {
            User adminUser = userRepository.findAll().stream().findFirst().orElseGet(() -> {
                User u = User.builder()
                        .name("Nguyễn Thanh Bằng")
                        .studentId("B23DCCN066")
                        .className("")
                        .email("thanhbang@ptit.edu.vn")
                        .password(passwordEncoder.encode("admin"))
                        .build();
                return userRepository.save(u);
            });
            adminUser.setName("Nguyễn Thanh Bằng");
            adminUser.setStudentId("B23DCCN066");
            adminUser.setClassName("");
            adminUser.setEmail("thanhbang@ptit.edu.vn");
            userRepository.save(adminUser);

            String token = "jwt_" + UUID.randomUUID().toString().replace("-", "");
            Map<String, Object> resp = new HashMap<>();
            resp.put("token", token);
            resp.put("id", adminUser.getId());
            resp.put("name", "Quản trị viên (Admin)");
            resp.put("email", "admin@ptit.edu.vn");
            resp.put("studentId", "ADMIN");
            resp.put("className", "");
            resp.put("avatar", adminUser.getAvatar());
            return ResponseEntity.ok(resp);
        }

        // Tìm kiếm linh hoạt theo email, studentId hoặc tên
        Optional<User> userOpt = userRepository.findAll().stream()
                .filter(u -> inputAccount.equalsIgnoreCase(u.getEmail())
                        || inputAccount.equalsIgnoreCase(u.getStudentId())
                        || inputAccount.equalsIgnoreCase(u.getName())
                        || inputAccount.replace(" ", "").equalsIgnoreCase(u.getName().replace(" ", "")))
                .findFirst();

        // Nếu DB chưa có user nào, khởi tạo tài khoản mặc định
        if (userOpt.isEmpty() && userRepository.count() == 0) {
            User newUser = User.builder()
                    .name("Nguyễn Thanh Bằng")
                    .studentId("B23DCCN066")
                    .className("")
                    .email("thanhbang@ptit.edu.vn")
                    .password(passwordEncoder.encode("B23DCCN066"))
                    .build();
            userRepository.save(newUser);
            userOpt = Optional.of(newUser);
        }

        if (userOpt.isEmpty()) {
            // Thử lấy user đầu tiên nếu có
            userOpt = userRepository.findAll().stream().findFirst();
        }

        if (userOpt.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Tài khoản không tồn tại trong hệ thống"));
        }

        User user = userOpt.get();

        // Kiểm tra mật khẩu (hỗ trợ cả BCrypt và so sánh chuỗi hoặc mã sinh viên mặc
        // định)
        boolean passwordValid = false;
        if (inputPassword != null) {
            if ("B23DCCN066".equals(inputPassword) || "B23DCCN010".equals(inputPassword) || "B23DCCN108".equals(inputPassword) || "123456".equals(inputPassword) || "admin".equals(inputPassword)) {
                passwordValid = true;
            } else if (inputPassword.equals(user.getPassword())) {
                passwordValid = true;
            } else {
                try {
                    passwordValid = passwordEncoder.matches(inputPassword, user.getPassword());
                } catch (Exception ignored) {
                }
            }
        }

        if (!passwordValid) {
            return ResponseEntity.status(401).body(Map.of("message", "Email hoặc mật khẩu không chính xác"));
        }

        String token = "jwt_" + UUID.randomUUID().toString().replace("-", "");

        Map<String, Object> resp = new HashMap<>();
        resp.put("token", token);
        resp.put("id", user.getId());
        resp.put("name", user.getName());
        resp.put("email", user.getEmail());
        resp.put("studentId", user.getStudentId());
        resp.put("className", user.getClassName());
        resp.put("avatar", user.getAvatar());
        resp.put("linkFigma", "https://figma.com/@iotv2");
        resp.put("linkGithub", "https://github.com/iotv2/smart-farm");
        resp.put("linkPostman", "https://postman.com/collections/iotv2");
        resp.put("linkReport", "https://docs.google.com/document/d/iotv2-report");

        log.info(">> [AUTH SUCCESS] User logged in: {} ({})", user.getName(), user.getStudentId());
        return ResponseEntity.ok(resp);
    }

    @GetMapping("/profile")
    public ResponseEntity<?> getProfile() {
        User user = userRepository.findAll().stream().findFirst().orElse(null);
        if (user == null) {
            return ResponseEntity.status(404).body(Map.of("message", "Không tìm thấy hồ sơ người dùng"));
        }

        Map<String, Object> resp = new HashMap<>();
        resp.put("id", user.getId());
        resp.put("name", user.getName());
        resp.put("email", user.getEmail());
        resp.put("studentId", user.getStudentId());
        resp.put("className", user.getClassName());
        resp.put("avatar", user.getAvatar());
        resp.put("linkFigma", "https://figma.com/@iotv2");
        resp.put("linkGithub", "https://github.com/iotv2/smart-farm");
        resp.put("linkPostman", "https://postman.com/collections/iotv2");
        resp.put("linkReport", "https://docs.google.com/document/d/iotv2-report");

        return ResponseEntity.ok(resp);
    }

    @PutMapping("/profile")
    public ResponseEntity<?> updateProfile(@RequestBody Map<String, String> data) {
        User user = userRepository.findAll().stream().findFirst().orElse(null);
        if (user == null) {
            return ResponseEntity.status(404).body(Map.of("message", "Không tìm thấy người dùng"));
        }

        if (data.containsKey("name"))
            user.setName(data.get("name"));
        if (data.containsKey("studentId"))
            user.setStudentId(data.get("studentId"));
        if (data.containsKey("className"))
            user.setClassName(data.get("className"));
        if (data.containsKey("email"))
            user.setEmail(data.get("email"));
        if (data.containsKey("avatar"))
            user.setAvatar(data.get("avatar"));

        userRepository.save(user);
        log.info(">> [PROFILE UPDATED] User updated profile: {}", user.getName());

        return getProfile();
    }
}
