#!/usr/bin/env python3
"""
apply_v92_patch.py
Applies v9.2 handler wiring to main.py with surgical precision:
1. Add v9.2 imports to handlers import block
2. Replace /lex inline block with handle_lex call
3. Replace /sage inline block with handle_sage call
4. Replace /zora inline block with handle_zora call
5. Build handle_acc() function from the existing /acc inline block
6. Replace /acc inline entry with handle_accounting shim call
"""
import re, sys, subprocess

MAIN = "main.py"

with open(MAIN, encoding="utf-8") as f:
    text = f.read()

# ── Step 1: Extend handlers import ──────────────────────────────────────────
OLD_IMPORT = """from .handlers import (
    handle_news,
    emit_cmd_audit,
    handle_analyze,
    handle_watch,
    handle_watchlist,
    handle_eng,
    handle_estimator,
    handle_interior,
    handle_scout,
    handle_guardian,
    handle_system,
)"""

NEW_IMPORT = """from .handlers import (
    handle_news,
    emit_cmd_audit,
    handle_analyze,
    handle_watch,
    handle_watchlist,
    handle_eng,
    handle_estimator,
    handle_interior,
    handle_scout,
    handle_guardian,
    handle_system,
    handle_lex,
    handle_sage,
    handle_zora,
    handle_accounting,
)"""

if OLD_IMPORT in text:
    text = text.replace(OLD_IMPORT, NEW_IMPORT, 1)
    print("[OK] Step 1: Updated handlers import block")
else:
    print("[WARN] Step 1: Could not find import block — may already be updated")

# ── Step 2-4: Replace /lex, /sage, /zora inline blocks ───────────────────────

def replace_cmd_block(src, cmd_name, fn_name, call_args="args, chat_id, settings, call_agent_and_reply"):
    """Replace `if cmd == "/xxx": ... user_msg = ... asyncio.create_task(...)` with fn call."""
    # Pattern: the if block up to and including `return`
    pat = (
        r'(    # /LEX[^\n]*\n)'          # comment line
        r'    if cmd == "/LEX":\n'        # if line
        r'        user_msg = " "\.join\(args\)\n'
        r'        await send_message\([^\n]+\n'
        r'        asyncio\.create_task\([^\n]+\n'
        r'        return\n'
    )
    pat = pat.replace("LEX", cmd_name.lstrip("/"))
    replacement = (
        f'    # /{cmd_name.lstrip("/")} — (delegated to handlers/advisory.py, v9.2)\n'
        f'    if cmd == "{cmd_name}":\n'
        f'        await {fn_name}({call_args})\n'
        f'        return\n'
    )
    new_src, n = re.subn(pat, replacement, src)
    if n:
        print(f"[OK] Replaced {cmd_name} block")
    else:
        print(f"[WARN] Could not find {cmd_name} block via regex — trying literal")
        # Literal fallback: find "    if cmd == \"/xxx\":" and replace the whole block
        start_marker = f'    if cmd == "{cmd_name}":\n'
        idx = src.find(start_marker)
        if idx == -1:
            print(f"[ERR] {cmd_name} not found at all!")
            return src
        # Find end of this block (next `        return\n`)
        end_search = src.find("        return\n", idx)
        if end_search == -1:
            print(f"[ERR] Could not find return for {cmd_name}")
            return src
        end_idx = end_search + len("        return\n")
        # Find start of comment line before if
        comment_start = src.rfind("\n    # ", 0, idx)
        if comment_start == -1:
            block_start = idx
        else:
            block_start = comment_start + 1  # skip the leading \n

        new_block = (
            f'    # /{cmd_name.lstrip("/")} — (delegated to handlers/advisory.py, v9.2)\n'
            f'    if cmd == "{cmd_name}":\n'
            f'        await {fn_name}({call_args})\n'
            f'        return\n'
        )
        new_src = src[:block_start] + new_block + src[end_idx:]
        print(f"[OK] Replaced {cmd_name} block (literal fallback)")
    return new_src

text = replace_cmd_block(text, "/lex", "handle_lex")
text = replace_cmd_block(text, "/sage", "handle_sage")
text = replace_cmd_block(text, "/zora", "handle_zora")

# ── Step 5: Extract /acc inline block into handle_acc() function ──────────────
# Find the /acc router entry
acc_if_marker = '    if cmd == "/acc":\n'
acc_idx = text.find(acc_if_marker)
if acc_idx == -1:
    print("[ERR] /acc block not found!")
    sys.exit(1)

# Find the end of the /acc block: look for the NEXT `    if cmd == "` or top-level def
# after the /acc block starts
after_acc = text[acc_idx + len(acc_if_marker):]

# Find where the /acc block ends by looking for the next top-level if cmd or def
# The /acc block is everything indented under `if cmd == "/acc":`
end_marker_patterns = [
    "\n    if cmd == \"/",   # next cmd block
    "\n    # fallback",
    "\nasync def ",
    "\ndef ",
]

end_relative = None
for pat in end_marker_patterns:
    idx_found = after_acc.find(pat)
    if idx_found != -1:
        if end_relative is None or idx_found < end_relative:
            end_relative = idx_found

if end_relative is None:
    print("[ERR] Could not find end of /acc block!")
    sys.exit(1)

acc_body = after_acc[:end_relative]
after_acc_tail = after_acc[end_relative:]

# Extract the inner content (strip the `        ` 8-space indent that the body has)
# and build a standalone handle_acc() function
acc_body_lines = acc_body.split("\n")
# The first line would be like "        sub = args[0].lower() if args else \"\""
# Re-indent from 8sp to 4sp
func_body_lines = []
for line in acc_body_lines:
    if line.startswith("        "):
        func_body_lines.append("    " + line[8:])
    elif line.startswith("    ") and not line.startswith("        "):
        # 4-space lines inside the block
        func_body_lines.append(line)
    else:
        func_body_lines.append(line)

handle_acc_fn = (
    "\n\nasync def handle_acc(\n"
    "    args: list[str], chat_id: int | str, settings\n"
    ") -> None:\n"
    '    """Handle /acc command — Kay 會計幕僚 (full implementation)."""\n'
    "    sub = args[0].lower() if args else \"\"\n"
    "    sub_args = args[1:]\n"
)
# Remove any `sub = ` or `sub_args = ` lines from extracted body (we add them in the header)
cleaned_body_lines = []
for line in func_body_lines:
    stripped = line.strip()
    if stripped.startswith("sub = args[0]") or stripped.startswith("sub_args = args[1:]"):
        continue
    cleaned_body_lines.append(line)

handle_acc_fn += "\n".join(cleaned_body_lines)

# ── Step 6: Replace the /acc router entry with the shim call ─────────────────
# Find comment line before /acc
comment_before_acc = text.rfind("\n    # /acc", 0, acc_idx)
if comment_before_acc != -1:
    block_start = comment_before_acc + 1
else:
    block_start = acc_idx

acc_shim = (
    "    # /acc — 會計師幕僚 (delegated to handlers/accounting.py with audit, v9.2)\n"
    "    if cmd == \"/acc\":\n"
    "        await handle_accounting(args, chat_id, settings, handle_acc)\n"
    "        return\n"
)

# Build the new text
new_text = (
    text[:block_start]
    + acc_shim
    + after_acc_tail
    + handle_acc_fn
    + "\n"
)

with open(MAIN, "w", encoding="utf-8") as f:
    f.write(new_text)

print("[OK] Step 5-6: Extracted handle_acc() and wired /acc shim")

# ── Final syntax check ───────────────────────────────────────────────────────
r = subprocess.run(["python", "-m", "py_compile", MAIN], capture_output=True, text=True)
if r.returncode == 0:
    print("[✅] Syntax clean!")
else:
    print("[❌] Syntax errors:")
    print(r.stderr)
    sys.exit(1)
