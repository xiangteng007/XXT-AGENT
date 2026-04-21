import re
import html

with open("c:\\Users\\xiang\\XXT-AGENT\\services\\telegram-command-bot\\src\\main.py", "r", encoding="utf-8") as f:
    content = f.read()

if "import html" not in content:
    content = content.replace("import json", "import json\nimport html")

content = re.sub(
    r'(reply = data\.get\("reply"\) or data\.get\("answer"\) or ".*?")',
    r'\1\n                    reply = html.escape(reply)',
    content
)

content = re.sub(
    r'(reply = _re\.sub\(r"<think>.*?</think>", "", reply, flags=0x10\)\.strip\(\))',
    r'\1\n            reply = html.escape(reply)',
    content
)

content = re.sub(
    r'(answer = re\.sub\(r"<think>.*?</think>", "", answer, flags=re\.DOTALL\)\.strip\(\))',
    r'\1\n            answer = html.escape(answer)',
    content
)

content = re.sub(
    r'(reply = d\.get\("reply", ""\))',
    r'\1\n        reply = html.escape(reply)',
    content
)

# Wait, handle_ai_query has:
# reply = re.sub(r'<think>.*?</think>', '', reply, flags=re.DOTALL).strip()
content = re.sub(
    r"(reply = re\.sub\(r'<think>\.\*\?</think>', '', reply, flags=re\.DOTALL\)\.strip\(\))",
    r"\1\n        reply = html.escape(reply)",
    content
)

with open("c:\\Users\\xiang\\XXT-AGENT\\services\\telegram-command-bot\\src\\main.py", "w", encoding="utf-8") as f:
    f.write(content)

print("Patched main.py")
