import os
import requests
from dotenv import load_dotenv

def update_commands():
    load_dotenv()
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        print("TELEGRAM_BOT_TOKEN not found in environment.")
        return

    url = f"https://api.telegram.org/bot{token}/setMyCommands"
    commands = [
        {"command": "help", "description": "顯示所有指令"},
        {"command": "butler", "description": "呼叫貼身管家為您服務"},
        {"command": "info", "description": "查詢客戶、公司與個人資訊"},
        {"command": "vehicle", "description": "查詢車輛保養資料"},
        {"command": "eng", "description": "查詢工程進度、BIM與營造管理"},
        {"command": "estimator", "description": "查詢工程估算與計價"},
        {"command": "interior", "description": "查詢室內設計與裝潢建議"},
        {"command": "scout", "description": "無人機與飛行任務管理"},
        {"command": "lex", "description": "智財與合約法務諮詢"},
        {"command": "sage", "description": "數據分析與統計解讀"},
        {"command": "zora", "description": "企業社會責任與非營利參與"},
        {"command": "acc", "description": "稅務/帳務自由問答"},
        {"command": "loan", "description": "貸款融資諮詢"},
        {"command": "ins", "description": "保單與保險諮詢"},
        {"command": "analyze", "description": "Triple Fusion 深度分析"},
        {"command": "watch", "description": "追蹤股票"},
        {"command": "watchlist", "description": "查看監控清單"},
        {"command": "reg", "description": "全分類法規語義搜尋"},
        {"command": "social", "description": "社群信號與熱門話題掃描"},
        {"command": "admin", "description": "行政與一般客服問題"},
        {"command": "ai", "description": "本地 AI 自由問答"},
        {"command": "agents", "description": "切換對話代理(Agent)"},
        {"command": "system", "description": "GPU / Ollama 狀態監控"}
    ]

    response = requests.post(url, json={"commands": commands})
    if response.status_code == 200:
        print("Successfully updated Telegram bot commands!")
        print(response.json())
    else:
        print(f"Failed to update commands. Status code: {response.status_code}")
        print(response.text)

if __name__ == "__main__":
    update_commands()
