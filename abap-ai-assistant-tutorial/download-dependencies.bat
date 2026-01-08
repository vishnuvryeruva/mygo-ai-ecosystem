@echo off
REM Download Dependencies for ABAP AI Assistant Plugin

echo ================================================
echo ABAP AI Assistant - Dependency Download Script
echo ================================================
echo.

REM Create lib directory if it doesn't exist
if not exist lib mkdir lib

REM Download org.json library
echo Downloading org.json library...
curl -L -o lib\org.json-20240303.jar ^
  "https://repo1.maven.org/maven2/org/json/json/20240303/json-20240303.jar"

if %ERRORLEVEL% EQU 0 (
    echo [32m✓ Successfully downloaded org.json-20240303.jar[0m
) else (
    echo [31m✗ Failed to download org.json library[0m
    echo   Please download manually from:
    echo   https://mvnrepository.com/artifact/org.json/json/20240303
    exit /b 1
)

echo.
echo ================================================
echo All dependencies downloaded successfully!
echo ================================================
echo.
echo Next steps:
echo 1. Import this project into Eclipse
echo 2. Run As ^> Eclipse Application
echo 3. Configure your OpenAI API key in preferences
echo.

pause


