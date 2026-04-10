"""
Ingest Pipeline — 台灣法規 PDF → Chroma DB

使用方式：
  python ingest.py                    # 全部重新 ingest
  python ingest.py --category building # 只 ingest 建築法規
  python ingest.py --source data/building-code/  # 只指定目錄
  python ingest.py --dry-run          # 試跑（不寫入 DB）

支援格式：
  .pdf  — 使用 pdfplumber 解析
  .txt  — 直接讀取（pre-processed 純文字條文）
  .html — 使用 BeautifulSoup 解析（台灣法規資料庫 HTML）

Chunk 策略：
  - 預設以「條文」為單位切割（偵測「第X條」Pattern）
  - 若條文過長（>1000 字），再以 512 字 sliding window 切割
  - 保留來源條文號、頁碼、法規版本日期作為 metadata
"""

import argparse
import os
import sys
import re
import hashlib
from pathlib import Path
from datetime import datetime
import time

# ── 設定 ──────────────────────────────────────────────────────
CHROMA_PATH   = os.getenv("CHROMA_PATH", "./data/chroma_db")
OLLAMA_BASE   = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
EMBED_MODEL   = os.getenv("EMBED_MODEL", "nomic-embed-text")
MAX_CHUNK_LEN = int(os.getenv("MAX_CHUNK_LEN", "800"))   # 最大 chunk 字數
OVERLAP_LEN   = int(os.getenv("OVERLAP_LEN", "100"))     # 重疊區段字數（防止條文截斷）
BATCH_SIZE    = int(os.getenv("EMBED_BATCH_SIZE", "20")) # 每批 embed 數量

# ── 法規目錄映射 ───────────────────────────────────────────────
CATEGORY_MAP = {
    "building": {
        "dir": "data/building-code",
        "label": "建築法規",
        "knowledge_date": "2024-07-01",
        "sources": [
            "建築技術規則建築設計施工編",
            "建築技術規則建築構造編",
            "建築法",
        ],
    },
    "fire": {
        "dir": "data/fire-safety",
        "label": "消防法規",
        "knowledge_date": "2024-01-01",
        "sources": [
            "消防法",
            "消防法施行細則",
            "各類場所消防安全設備設置標準",
        ],
    },
    "cns": {
        "dir": "data/cns-standards",
        "label": "CNS 國家標準",
        "knowledge_date": "2023-12-01",
        "sources": ["CNS 560", "CNS 61", "CNS 3036"],
    },
    "tax": {
        "dir": "data/tax",
        "label": "稅務法規",
        "knowledge_date": "2024-01-01",
        "sources": ["統一發票使用辦法", "加值型及非加值型營業稅法"],
    },
    "labor": {
        "dir": "data/labor",
        "label": "勞工法規",
        "knowledge_date": "2024-01-01",
        "sources": ["勞動基準法", "職業安全衛生法"],
    },
}

# ── 文字提取 ──────────────────────────────────────────────────
def extract_text_from_pdf(filepath: Path) -> str:
    """使用 pdfplumber 提取 PDF 文字"""
    try:
        import pdfplumber
        text_parts = []
        with pdfplumber.open(filepath) as pdf:
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    text_parts.append(t)
        return "\n".join(text_parts)
    except ImportError:
        print("[WARN] pdfplumber not installed. Run: pip install pdfplumber")
        return ""
    except Exception as e:
        print(f"[WARN] PDF extraction failed for {filepath}: {e}")
        return ""


def extract_text_from_html(filepath: Path) -> str:
    """使用 BeautifulSoup 提取 HTML 中的條文文字"""
    try:
        from bs4 import BeautifulSoup
        with open(filepath, encoding="utf-8", errors="ignore") as f:
            soup = BeautifulSoup(f.read(), "html.parser")
        # 移除 script/style
        for tag in soup(["script", "style", "nav", "header", "footer"]):
            tag.decompose()
        return soup.get_text(separator="\n")
    except ImportError:
        print("[WARN] beautifulsoup4 not installed. Run: pip install beautifulsoup4")
        return ""
    except Exception as e:
        print(f"[WARN] HTML extraction failed for {filepath}: {e}")
        return ""


def extract_text(filepath: Path) -> str:
    ext = filepath.suffix.lower()
    if ext == ".pdf":
        return extract_text_from_pdf(filepath)
    elif ext in (".html", ".htm"):
        return extract_text_from_html(filepath)
    elif ext == ".txt":
        with open(filepath, encoding="utf-8", errors="ignore") as f:
            return f.read()
    else:
        print(f"[SKIP] Unsupported format: {filepath}")
        return ""


# ── 條文切割 ──────────────────────────────────────────────────
# 偵測「第XX條」、「§XX」、「Article XX」
ARTICLE_PATTERN = re.compile(
    r"(?:第\s*[零一二三四五六七八九十百千\d]+\s*條|§\s*\d+|Article\s+\d+)",
    re.IGNORECASE,
)

def split_into_chunks(text: str, max_len: int = MAX_CHUNK_LEN, overlap: int = OVERLAP_LEN) -> list[dict]:
    """
    智慧切割條文

    策略：
    1. 嘗試以「第XX條」為切割點
    2. 若單條過長，再以 sliding window 細切
    3. 短條文自動合併（< 50 字）
    """
    # 找出所有條文邊界
    matches = list(ARTICLE_PATTERN.finditer(text))

    raw_chunks: list[tuple[str, str]] = []  # (article_number, content)

    if len(matches) >= 3:
        # 有足夠條文邊界 → 以條文為單位
        for i, m in enumerate(matches):
            end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
            article_num = m.group(0).strip()
            content = text[m.start():end].strip()
            if len(content) > 30:  # 過濾空條文
                raw_chunks.append((article_num, content))
    else:
        # 無條文結構 → 以段落切割
        paragraphs = [p.strip() for p in text.split("\n\n") if len(p.strip()) > 30]
        for p in paragraphs:
            raw_chunks.append(("", p))

    # 對過長的 chunk 做 sliding window 切割
    final_chunks: list[dict] = []
    for article_num, content in raw_chunks:
        if len(content) <= max_len:
            final_chunks.append({"article": article_num, "text": content})
        else:
            # Sliding window
            i = 0
            part = 0
            while i < len(content):
                window = content[i:i + max_len]
                final_chunks.append({
                    "article": f"{article_num}（{part + 1}）" if article_num else f"段落{part + 1}",
                    "text": window,
                })
                i += max_len - overlap
                part += 1

    return final_chunks


# ── Embedding 批次處理 ─────────────────────────────────────────
def embed_chunks_sync(texts: list[str], ollama_base: str, model: str) -> list[list[float]]:
    """同步批次取得 embeddings（避免 asyncio event loop 問題）"""
    import httpx
    vecs = []
    for text in texts:
        resp = httpx.post(
            f"{ollama_base}/api/embed",
            json={"model": model, "input": text},
            timeout=60.0,
        )
        resp.raise_for_status()
        data = resp.json()
        embeddings = data.get("embeddings") or data.get("embedding", [])
        vec = embeddings[0] if embeddings and isinstance(embeddings[0], list) else embeddings
        vecs.append(vec)
    return vecs


# ── 主要 Ingest 函數 ──────────────────────────────────────────
def ingest_directory(
    dir_path: Path,
    category: str,
    category_info: dict,
    store,  # RegulationStore
    dry_run: bool = False,
) -> dict:
    """
    掃描目錄，提取所有法規文件並寫入 Chroma

    Returns:
        {"files": int, "chunks": int, "skipped": int}
    """
    stats = {"files": 0, "chunks": 0, "skipped": 0, "errors": 0}

    if not dir_path.exists():
        print(f"[INFO] Directory not found, creating: {dir_path}")
        dir_path.mkdir(parents=True, exist_ok=True)
        print(f"[INFO] Place regulation files in: {dir_path.absolute()}")
        return stats

    supported_ext = {".pdf", ".txt", ".html", ".htm"}
    files = [f for f in dir_path.rglob("*") if f.suffix.lower() in supported_ext]

    if not files:
        print(f"[WARN] No supported files found in {dir_path}")
        print(f"  → Place PDF/TXT/HTML files in: {dir_path.absolute()}")
        return stats

    for filepath in sorted(files):
        print(f"\n[FILE] {filepath.name}")
        text = extract_text(filepath)

        if not text.strip():
            print(f"  → [SKIP] Empty or unreadable")
            stats["skipped"] += 1
            continue

        chunks = split_into_chunks(text)
        print(f"  → {len(chunks)} chunks")

        if dry_run:
            for i, chunk in enumerate(chunks[:3]):
                print(f"     chunk[{i}]: {chunk['article']} | {chunk['text'][:60]}...")
            stats["chunks"] += len(chunks)
            stats["files"] += 1
            continue

        # 批次 embed
        all_records = []
        for batch_start in range(0, len(chunks), BATCH_SIZE):
            batch = chunks[batch_start:batch_start + BATCH_SIZE]
            texts = [c["text"] for c in batch]

            try:
                vecs = embed_chunks_sync(texts, OLLAMA_BASE, EMBED_MODEL)
            except Exception as e:
                print(f"  → [ERROR] Embedding failed: {e}")
                stats["errors"] += 1
                continue

            for j, (chunk, vec) in enumerate(zip(batch, vecs)):
                chunk_idx = batch_start + j
                # 穩定唯一 ID：基於來源檔案 + 條文號 + 位置
                uid_src = f"{category}::{filepath.name}::{chunk['article']}::{chunk_idx}"
                chunk_id = hashlib.md5(uid_src.encode()).hexdigest()[:16]

                all_records.append({
                    "id": chunk_id,
                    "embedding": vec,
                    "content": chunk["text"],
                    "metadata": {
                        "source": f"{category_info['label']} {chunk['article']}".strip(),
                        "source_doc": filepath.name,
                        "category": category,
                        "knowledge_date": category_info["knowledge_date"],
                        "article_number": chunk["article"],
                        "file_path": str(filepath),
                    },
                })

            print(f"  → batch [{batch_start}:{batch_start + len(batch)}] embedded ✓")
            time.sleep(0.1)  # 避免 Ollama 過載

        written = store.upsert_chunks(all_records)
        print(f"  → {written} chunks written to Chroma")
        stats["chunks"] += written
        stats["files"] += 1

    return stats


# ── CLI ───────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="台灣法規 Ingest Pipeline")
    parser.add_argument("--category", choices=list(CATEGORY_MAP.keys()), help="只 ingest 指定分類")
    parser.add_argument("--source", help="指定單一目錄路徑")
    parser.add_argument("--dry-run", action="store_true", help="試跑，不寫入 DB")
    parser.add_argument("--list", action="store_true", help="列出知識庫現有內容")
    args = parser.parse_args()

    from regulation_store import RegulationStore
    store = RegulationStore(chroma_path=CHROMA_PATH)

    if args.list:
        print(f"\n=== 知識庫現有內容（{CHROMA_PATH}）===")
        print(f"總 chunks: {store.total_chunks()}")
        for cat in store.list_categories():
            count = store.total_chunks(category=cat)
            print(f"  {cat}: {count} chunks")
        sources = store.list_sources()
        print(f"\n已載入文件：")
        for s in sources:
            print(f"  [{s['category']}] {s['source']} (截至 {s['knowledge_date']})")
        return

    # 決定要 ingest 哪些分類
    if args.source:
        categories = {"custom": {
            "dir": args.source,
            "label": "自訂法規",
            "knowledge_date": datetime.now().strftime("%Y-%m-%d"),
        }}
    elif args.category:
        categories = {args.category: CATEGORY_MAP[args.category]}
    else:
        categories = CATEGORY_MAP

    total_stats = {"files": 0, "chunks": 0, "skipped": 0, "errors": 0}

    print(f"\n{'[DRY RUN] ' if args.dry_run else ''}開始 Ingest 法規知識庫")
    print(f"Ollama: {OLLAMA_BASE} | Model: {EMBED_MODEL}")
    print(f"Chroma: {CHROMA_PATH}")
    print("=" * 60)

    # 先確認 Ollama 可達，並確保 nomic-embed-text 已安裝
    if not args.dry_run:
        import httpx
        try:
            r = httpx.get(f"{OLLAMA_BASE}/api/tags", timeout=5)
            models = [m["name"] for m in r.json().get("models", [])]
            if EMBED_MODEL not in models and not any(EMBED_MODEL in m for m in models):
                print(f"\n[WARN] Embed model '{EMBED_MODEL}' not found in Ollama.")
                print(f"  → 正在拉取 {EMBED_MODEL}...")
                os.system(f"ollama pull {EMBED_MODEL}")
        except Exception as e:
            print(f"[ERROR] Cannot reach Ollama: {e}")
            print("Please ensure Ollama is running: ollama serve")
            sys.exit(1)

    for cat_key, cat_info in categories.items():
        print(f"\n[CATEGORY] {cat_key} — {cat_info.get('label', '')}")
        dir_path = Path(cat_info["dir"])
        stats = ingest_directory(dir_path, cat_key, cat_info, store, dry_run=args.dry_run)
        for k, v in stats.items():
            total_stats[k] += v

    print("\n" + "=" * 60)
    print(f"✅ Ingest 完成")
    print(f"   文件數: {total_stats['files']}")
    print(f"   Chunks: {total_stats['chunks']}")
    print(f"   略過:   {total_stats['skipped']}")
    print(f"   錯誤:   {total_stats['errors']}")
    print(f"\n總 chunks in DB: {store.total_chunks()}")


if __name__ == "__main__":
    main()
