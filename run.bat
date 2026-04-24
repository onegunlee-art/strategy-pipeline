@echo off
cd /d "%~dp0"
echo [1/2] 최신 코드 업데이트 중...
git pull origin claude/kt-ai-strategy-ppt-cpoxz-new
echo.
echo [2/2] 앱 실행 중...
streamlit run app.py
pause
