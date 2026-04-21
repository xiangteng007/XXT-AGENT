import re
import html

def format_for_telegram(text: str) -> str:
    """Format Markdown text to Telegram-supported HTML."""
    if not text:
        return ""
    # Escape HTML to prevent Telegram parsing errors with arbitrary < >
    text = html.escape(text)
    
    # Code blocks (multi-line)
    text = re.sub(r'```(?:.*?)\n(.*?)\n```', r'<pre><code>\1</code></pre>', text, flags=re.DOTALL)
    
    # Code: `code` -> <code>code</code>
    text = re.sub(r'`(.+?)`', r'<code>\1</code>', text)
    
    # Headers: ### Header -> <b>Header</b>
    text = re.sub(r'(?m)^###\s+(.+)$', r'<b>\1</b>', text)
    text = re.sub(r'(?m)^##\s+(.+)$', r'<b>\1</b>', text)
    text = re.sub(r'(?m)^#\s+(.+)$', r'<b>\1</b>', text)
    
    # Bold: **text** -> <b>text</b>
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
    
    # Bold: __text__ -> <b>text</b>
    text = re.sub(r'__(.+?)__', r'<b>\1</b>', text)
    
    # Italic: *text* -> <i>text</i> (Be careful with list items)
    # A list item is `* item` so there is a space after `*`.
    # A valid italic starts with `*` followed by non-space, ends with `*`.
    text = re.sub(r'(?<!\*)\*(?!\s)(.+?)(?<!\s)\*(?!\*)', r'<i>\1</i>', text)
    
    # Italic: _text_ -> <i>text</i>
    text = re.sub(r'(?<!_)_(?!\s)(.+?)(?<!\s)_(?!_)', r'<i>\1</i>', text)
    
    # Links: [text](url) -> <a href="url">text</a>
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', text)
    
    # Lists: - item or * item -> • item
    text = re.sub(r'(?m)^\s*[-*]\s+', r'• ', text)
    
    return text

sample = """
### Header
Here is **bold** and *italic*.
- item 1
* item 2

```python
print("Hello")
```

[link](https://example.com)
"""
print(format_for_telegram(sample))
