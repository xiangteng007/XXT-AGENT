"""PM2 launcher for telegram-command-bot.

Runs `python -m src.main` from the correct directory to handle relative imports.
"""
import subprocess
import sys
import os

os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.exit(subprocess.call([sys.executable, "-m", "src.main"]))
