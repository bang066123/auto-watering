@echo off
chcp 65001 >nul
title KHOI DONG HE THONG SMART WATERING (IOTV2)

echo ================================================================
echo       DANG KHOI DONG TOAN BO HE THONG SMART WATERING (IOTV2)
echo ================================================================

:: 1. Kiem tra va khoi dong MySQL 8.4 neu chua chay
echo [1/3] Kiem tra dich vu MySQL...
sc query MySQL84 | find "RUNNING" >nul
if %errorlevel% neq 0 (
    echo Dang khoi dong service MySQL84...
    net start MySQL84 >nul 2>&1
)
"D:\My SQL\bin\mysql.exe" -u root -pCuong2005@ -e "CREATE DATABASE IF NOT EXISTS iotv2_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" >nul 2>&1
echo   [OK] Co so du lieu iotv2_db san sang.

:: 2. Khoi dong Mosquitto MQTT Broker
echo [2/3] Kiem tra va khoi dong Mosquitto MQTT Broker (Port 1884)...
tasklist /FI "IMAGENAME eq mosquitto.exe" 2>nul | find /I "mosquitto.exe" >nul
if %errorlevel% equ 0 (
    echo   [OK] Mosquitto MQTT Broker da dang chay tren cong 1884.
) else (
    set "CONF_FILE=%~dp0..\mosquitto.conf"
    if not exist "%CONF_FILE%" set "CONF_FILE=%~dp0mosquitto.conf"
    if not exist "%CONF_FILE%" set "CONF_FILE=C:\IOTv2\mosquitto.conf"
    start "Mosquitto MQTT Broker" "C:\Program Files\Mosquitto\mosquitto.exe" -c "%CONF_FILE%" -v
    echo   [OK] Da khoi dong Mosquitto MQTT Broker.
)

timeout /t 2 /nobreak >nul

:: 3. Khoi dong Backend Spring Boot
echo [3/3] Dang khoi dong Backend Spring Boot...
set "BACKEND_RUN=%~dp0backend\run.bat"
if exist "%BACKEND_RUN%" (
    start "Backend Spring Boot" "%BACKEND_RUN%"
) else (
    echo [LOI] Khong tim thay file run.bat!
)

echo.
echo ================================================================
echo   [OK] Da phat lenh khoi dong toan bo he thong!
echo   - MQTT Mosquitto: Port 1884 (User: HoangManhCuong)
echo   - Backend: http://localhost:8080
echo   - Frontend: http://localhost:5173 (se tu dong mo)
echo   - Tai khoan web: HoangManhCuong / B23DCCN108
echo ================================================================
pause
