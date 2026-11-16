@echo off
title MQTT Mosquitto Broker (Port 1884)
echo ===================================================
echo KHOI DONG MQTT MOSQUITTO BROKER (PORT 1884)
echo ===================================================
set "CONF_FILE=C:\IOTv2\mosquitto.conf"
if exist "%~dp0..\mosquitto.conf" set "CONF_FILE=%~dp0..\mosquitto.conf"
if exist "%~dp0mosquitto.conf" set "CONF_FILE=%~dp0mosquitto.conf"

"C:\Program Files\Mosquitto\mosquitto.exe" -c "%CONF_FILE%" -v
pause
