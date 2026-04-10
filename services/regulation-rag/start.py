"""
Regulation RAG — 服務啟動腳本（Windows）
功能：一鍵初始化知識庫並啟動 FastAPI 服務

執行：python start.py
"""

import subprocess
import sys
import os
from pathlib import Path

VENV_DIR = Path(".venv")
PYTHON = str(VENV_DIR / "Scripts" / "python.exe") if os.name == "nt" else str(VENV_DIR / "bin" / "python")
PIP = str(VENV_DIR / "Scripts" / "pip.exe") if os.name == "nt" else str(VENV_DIR / "bin" / "pip")


def run(cmd: list[str], **kwargs) -> int:
    print(f"\n$ {' '.join(str(c) for c in cmd)}")
    result = subprocess.run(cmd, **kwargs)
    return result.returncode


def main():
    print("=" * 60)
    print("  XXT-AGENT Regulation RAG Startup")
    print("  NemoClaw Layer 4 — 台灣法規知識庫")
    print("=" * 60)

    # 1. 建立 venv
    if not VENV_DIR.exists():
        print("\n[1/4] 建立 Python 虛擬環境...")
        rc = run([sys.executable, "-m", "venv", str(VENV_DIR)])
        if rc != 0:
            print("❌ venv 建立失敗")
            sys.exit(1)
    else:
        print("\n[1/4] venv 已存在 ✓")

    # 2. 安裝依賴
    print("\n[2/4] 安裝 Python 依賴...")
    rc = run([PIP, "install", "-r", "requirements.txt", "-q"])
    if rc != 0:
        print("❌ pip install 失敗")
        sys.exit(1)
    print("✅ 依賴安裝完成")

    # 3. 生成種子資料（若 data/ 目錄是空的）
    data_dir = Path("data")
    has_files = any(data_dir.rglob("*.txt")) or any(data_dir.rglob("*.pdf")) if data_dir.exists() else False
    if not has_files:
        print("\n[3/4] 生成種子法規資料...")
        rc = run([PYTHON, "seed_data.py"])

        print("\n       開始 Ingest 種子資料到 Chroma DB...")
        rc = run([PYTHON, "ingest.py"])
        if rc != 0:
            print("⚠️  Ingest 失敗（可能是 Ollama 未啟動）")
            print("   稍後可手動執行: python ingest.py")
    else:
        print("\n[3/4] 法規資料已存在，跳過種子生成")
        chroma_dir = Path("data/chroma_db")
        if not chroma_dir.exists():
            print("       但 Chroma DB 為空，執行 ingest...")
            run([PYTHON, "ingest.py"])

    # 4. 啟動 FastAPI
    print("\n[4/4] 啟動 Regulation RAG API...")
    print("  URL: http://localhost:8092")
    print("  文件: http://localhost:8092/docs")
    print("  健康: http://localhost:8092/health")
    print("\n  按 Ctrl+C 停止服務\n")

    run([PYTHON, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8092", "--reload"])


if __name__ == "__main__":
    main()
