@echo off
title Backend Spring Boot - Smart Watering
echo ================================================================
echo       KHOI DONG BACKEND SPRING BOOT (PORT 8080)
echo ================================================================
set "JAVA_HOME=C:\Program Files\JetBrains\IntelliJ IDEA 2026.1\jbr"
set "PATH=%JAVA_HOME%\bin;D:\apache-maven-3.9.11\bin;%PATH%"

cd /d "%~dp0"
call "D:\apache-maven-3.9.11\bin\mvn.cmd" spring-boot:run
pause
