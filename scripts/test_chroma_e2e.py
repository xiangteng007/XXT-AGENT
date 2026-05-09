"""E2E test: Ollama embed → ChromaDB NAS write → query"""
import json, time, urllib.request

OLLAMA = "http://localhost:11434"
CHROMA = "http://100.72.174.116:8000"
TOKEN = "4f78d91a9b4e4b7c8f2a6d3c1e5f8a2b"
TENANT = "default_tenant"
DB = "default_database"
COLL_NAME = "xxt_e2e_test"

def api(url, data=None, method="GET"):
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {TOKEN}"}
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

def embed(text):
    data = json.dumps({"model": "nomic-embed-text", "input": text}).encode()
    req = urllib.request.Request(f"{OLLAMA}/api/embed", data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())["embeddings"][0]

print("=" * 60)
print("  XXT-AGENT NAS ChromaDB E2E Test")
print("=" * 60)

# 1. Delete old test collection if exists
try:
    api(f"{CHROMA}/api/v2/tenants/{TENANT}/databases/{DB}/collections/{COLL_NAME}", method="DELETE")
    print("[1] Old collection deleted")
except: 
    print("[1] No old collection")

# 2. Create collection
coll = api(f"{CHROMA}/api/v2/tenants/{TENANT}/databases/{DB}/collections", {"name": COLL_NAME, "metadata": {"hnsw:space": "cosine"}}, "POST")
coll_id = coll["id"]
print(f"[2] Collection created: {coll_id}")

# 3. Generate embeddings + write 3 test memories
memories = [
    "記住：我的名字是小向，生日是 10 月 7 日",
    "XXT-AGENT 是一個多模態 AI 代理系統，部署在 GCP Cloud Run 上",
    "NAS 位於 ASUSTOR 設備上，IP 是 100.72.174.116，運行 ChromaDB 和 Redis",
]

for i, mem in enumerate(memories):
    t0 = time.time()
    vec = embed(mem)
    embed_ms = int((time.time() - t0) * 1000)
    
    t1 = time.time()
    api(f"{CHROMA}/api/v2/tenants/{TENANT}/databases/{DB}/collections/{coll_id}/add", {
        "ids": [f"mem_e2e_{i:03d}"],
        "documents": [mem],
        "metadatas": [{"agentId": "e2e", "userId": "test-user", "timestamp": "2026-05-06T03:35:00Z", "source": "system"}],
        "embeddings": [vec],
    }, "POST")
    write_ms = int((time.time() - t1) * 1000)
    print(f"[3.{i}] Stored: '{mem[:30]}...' | embed={embed_ms}ms write={write_ms}ms dims={len(vec)}")

# 4. Query: ask a question
queries = [
    "小向的生日是什麼時候？",
    "NAS 的 IP 位址是多少？",
    "什麼是 XXT-AGENT？",
]

print("\n--- Query Results ---")
for q in queries:
    t0 = time.time()
    qvec = embed(q)
    result = api(f"{CHROMA}/api/v2/tenants/{TENANT}/databases/{DB}/collections/{coll_id}/query", {
        "query_embeddings": [qvec],
        "n_results": 2,
    }, "POST")
    query_ms = int((time.time() - t0) * 1000)
    
    print(f"\nQ: {q} ({query_ms}ms)")
    for j, (doc, dist) in enumerate(zip(result["documents"][0], result["distances"][0])):
        sim = max(0, 1 - dist)
        print(f"  [{j+1}] sim={sim:.3f} | {doc}")

# 5. Verify collection count
colls = api(f"{CHROMA}/api/v2/tenants/{TENANT}/databases/{DB}/collections")
print(f"\n[5] Total collections on NAS: {len(colls)}")
for c in colls:
    print(f"    - {c['name']} (dim={c.get('dimension', '?')})")

print("\n✅ E2E test complete!")
