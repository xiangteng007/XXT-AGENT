#!/usr/bin/env python3
"""
fix_orphan_blocks.py
Find all orphan top-level `    if cmd == ...` blocks that are INSIDE handle_acc
(because of the misindented extraction) and move them outside.

Strategy:
- Read file line by line
- Detect handle_acc function start
- Scan inside handle_acc for any `    if cmd == "/xxx":` blocks (4 spaces)
  that follow a `    return` — these are unreachable dead code from the old inline router
- Remove the `    return\n\n    # /xxx` ... body from handle_acc
- Re-add them at the correct indentation level after handle_acc closes
"""
import re, sys

MAIN_PY = "main.py"

with open(MAIN_PY, encoding="utf-8") as f:
    lines = f.readlines()

total = len(lines)
print(f"Total lines: {total}")

# Find handle_acc start
acc_start = None
for i, line in enumerate(lines):
    if line.startswith("async def handle_acc("):
        acc_start = i
        break

if acc_start is None:
    print("[ERROR] handle_acc() not found"); sys.exit(1)
print(f"handle_acc starts at L{acc_start+1}")

# Find handle_acc end: next top-level (0-indent) def/class/variable
acc_end = None
for i in range(acc_start + 3, total):
    line = lines[i]
    if line and not line[0].isspace() and line.strip() and not line.startswith("#"):
        acc_end = i
        break

if acc_end is None:
    acc_end = total
end_line_repr = lines[acc_end].rstrip() if acc_end < total else 'EOF'
print(f"handle_acc ends before L{acc_end+1}: {end_line_repr!r}")

# Inside handle_acc, find orphan cmd blocks:
# Pattern: 4-space `if cmd == "/xxx":` followed by body that has wrong indent
orphan_start = None
for i in range(acc_start, acc_end):
    # Look for `    if cmd == "/xxx":` with exactly 4 spaces (not 8)
    m = re.match(r'^    if cmd == "(/\w+)":\s*$', lines[i])
    if m:
        orphan_start = i
        print(f"[INFO] Orphan cmd block starts at L{i+1}: {lines[i].rstrip()!r}")
        break

if orphan_start is None:
    print("[INFO] No orphan cmd blocks found inside handle_acc")
    # Just run syntax check
    import subprocess
    r = subprocess.run(["python", "-m", "py_compile", "main.py"], capture_output=True, text=True)
    if r.returncode == 0:
        print("[OK] Syntax clean!")
    else:
        print("[ERR]", r.stderr)
    sys.exit(0)

# The orphan blocks span from orphan_start to acc_end
# handle_acc genuine body is acc_start to orphan_start
# Find the `return` just before orphan_start (the last genuine return of handle_acc)
genuine_end = orphan_start
# Walk backwards to find last non-empty line before orphan_start
for i in range(orphan_start - 1, acc_start, -1):
    if lines[i].strip():
        genuine_end = i + 1
        break

print(f"[INFO] Genuine handle_acc body: L{acc_start+1} to L{genuine_end}")
print(f"[INFO] Orphan blocks to extract: L{orphan_start+1} to L{acc_end}")

# Build new content:
# 1. Lines before handle_acc: unchanged
part1 = lines[:acc_start]

# 2. handle_acc genuine body (acc_start to genuine_end)
acc_body = lines[acc_start:genuine_end]
# Ensure it ends with newlines
if acc_body and acc_body[-1].strip():
    acc_body.append("\n")
acc_body.append("\n")

# 3. Orphan blocks — they need to be re-indented from 4sp to 8sp (inside webhook handler)
#    Actually they need to stay at 4sp since the main webhook function uses 4sp indentation
orphan_blocks = lines[orphan_start:acc_end]

# The orphan blocks have `    if cmd ==` (4sp) and body at `    try:` (4sp) — that's wrong
# Their body should be at 8sp. Let's check the actual indentation:
sample_body = lines[orphan_start + 1] if orphan_start + 1 < acc_end else ""
body_indent = len(sample_body) - len(sample_body.lstrip())
print(f"[INFO] Orphan body indent: {body_indent} spaces")

# Re-indent if body is at 4sp (should be 8sp for inside a `if cmd:` block)
fixed_orphans = []
inside_block = False
for line in orphan_blocks:
    if re.match(r'^    if cmd == "', line):
        inside_block = True
        fixed_orphans.append(line)  # Keep `    if cmd ==` as-is
    elif inside_block and line.strip() and not line.startswith("        "):
        # Body line not yet at 8sp — re-indent from 4sp to 8sp
        stripped = line.lstrip()
        current_indent = len(line) - len(stripped)
        if current_indent == 4:
            fixed_orphans.append("        " + stripped)
        else:
            fixed_orphans.append(line)
    else:
        fixed_orphans.append(line)

# 4. Rest of file after acc_end
rest = lines[acc_end:]

new_lines = part1 + acc_body + fixed_orphans + rest

with open(MAIN_PY, "w", encoding="utf-8") as f:
    f.writelines(new_lines)

print(f"[OK] Wrote {len(new_lines)} lines")

# Final syntax check
import subprocess
r = subprocess.run(["python", "-m", "py_compile", "main.py"], capture_output=True, text=True)
if r.returncode == 0:
    print("[OK] Syntax clean!")
else:
    print("[ERR]", r.stderr)
