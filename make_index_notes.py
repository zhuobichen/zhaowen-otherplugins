"""Generate one index note per classification sub-collection.

Usage:
    python make_index_notes.py                 # dry run: show counts
    python make_index_notes.py --apply         # write / update the notes
    python make_index_notes.py --only 深度学习 --apply


Each note lists every item in the sub-collection with a clickable
``zotero://select/library/items/KEY`` link and the first sentence of its note.
The note is then added to that same collection and tagged ``分类索引`` so it is
findable in one place.

Idempotent: an existing ``分类索引：<sub>`` note is updated in place rather than
duplicated.
"""
from __future__ import annotations

import argparse
import json
import re
import sqlite3
import shutil
import tempfile
import urllib.request
from pathlib import Path

ZOT = Path(r"E:\CodeProject\Zotero")
MCP_URL = "http://127.0.0.1:23120/mcp"
TAG = "分类索引"

# Collection name -> the parent's display order is handled by the plugin; here
# we only need a stable iteration order for reporting.
SUBS = [
    "统计地统计", "机器学习", "深度学习", "数据同化与集合",
    "产品互比与选择敏感性", "长期趋势与断点", "健康与暴露影响", "数据谱系与验证方法",
]


def snapshot() -> Path:
    tmp = Path(tempfile.gettempdir()) / "zt_batch"
    tmp.mkdir(exist_ok=True)
    for suffix in ("", "-wal", "-shm"):
        src = ZOT / ("zotero.sqlite" + suffix)
        if src.exists():
            shutil.copy2(src, tmp / ("zotero.sqlite" + suffix))
    return tmp / "zotero.sqlite"


def load(con, sub):
    cur = con.cursor()
    rows = cur.execute(
        """
        SELECT i.key,
          (SELECT idv.value FROM itemData id
             JOIN itemDataValues idv ON idv.valueID = id.valueID
             JOIN fields f ON f.fieldID = id.fieldID
           WHERE id.itemID = i.itemID AND f.fieldName = 'title') AS title,
          (SELECT idv.value FROM itemData id
             JOIN itemDataValues idv ON idv.valueID = id.valueID
             JOIN fields f ON f.fieldID = id.fieldID
           WHERE id.itemID = i.itemID AND f.fieldName = 'date') AS date,
          (SELECT n.note FROM itemNotes n
             WHERE n.parentItemID = i.itemID LIMIT 1) AS note
        FROM collections c
        JOIN collectionItems ci ON ci.collectionID = c.collectionID
        JOIN items i ON i.itemID = ci.itemID
        JOIN itemTypes it ON it.itemTypeID = i.itemTypeID
        WHERE c.collectionName = ? AND it.typeName <> 'note'
        ORDER BY CASE WHEN date IS NULL OR date = '' THEN 1 ELSE 0 END, date, i.key
        """,
        (sub,),
    ).fetchall()
    col = cur.execute(
        "SELECT collectionID, key FROM collections WHERE collectionName = ?",
        (sub,),
    ).fetchone()
    return rows, col


def plain(html, limit=220):
    if not html:
        return ""
    text = re.sub(r"<[^>]+>", " ", html)
    text = text.replace("&nbsp;", " ").replace("&amp;", "&")
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit]


def build(sub, rows):
    note_has = [r for r in rows if r[3]]
    no_date = [r for r in rows if not (r[2] or "").strip()]
    lines = [
        f"# 分类索引：{sub}",
        "",
        f"本笔记由分类子集 `{sub}` 自动汇总，共 {len(rows)} 篇。点击标题跳转到条目。",
        "",
        f"- 有笔记：{len(note_has)} 篇",
        f"- 无笔记：{len(rows) - len(note_has)} 篇",
    ]
    if no_date:
        lines.append(f"- 缺日期字段：{len(no_date)} 篇（元数据待补）")
    lines += ["", "## 文献列表", ""]
    for key, title, date, note in rows:
        digits = re.findall(r"(?:19|20)\d{2}", date or "")
        year = digits[0] if digits else "—"
        safe = (title or key).replace("[", "(").replace("]", ")")
        lines.append(f"### {year} · [{safe}](zotero://select/library/items/{key})")
        lines.append("")
        summary = plain(note)
        lines.append(f"*{summary}*" if summary else "*(暂无笔记)*")
        lines.append("")
    return "\n".join(lines)


def mcp(payload, session=None):
    headers = {"Content-Type": "application/json",
               "Accept": "application/json, text/event-stream"}
    if session:
        headers["Mcp-Session-Id"] = session
    req = urllib.request.Request(MCP_URL, data=json.dumps(payload).encode(),
                                 headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw = resp.read().decode("utf-8", "ignore")
        sid = resp.headers.get("Mcp-Session-Id") or session
    if not raw.strip():
        return {}, sid
    if raw.startswith(("event:", "id:")):
        for line in raw.splitlines():
            if line.startswith("data:"):
                raw = line[5:].strip()
                break
    return json.loads(raw), sid


def call(session, tool, arguments):
    res, _ = mcp({"jsonrpc": "2.0", "id": 9, "method": "tools/call",
                  "params": {"name": tool, "arguments": arguments}}, session)
    text = res.get("result", {}).get("content", [{}])[0].get("text", "{}")
    try:
        return json.loads(text)
    except Exception:
        return {"raw": text}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--only", help="single sub-collection name")
    args = parser.parse_args()

    con = sqlite3.connect(f"file:{snapshot()}?mode=ro", uri=True)
    targets = [args.only] if args.only else SUBS
    plan = {}
    for sub in targets:
        rows, col = load(con, sub)
        plan[sub] = {"rows": rows, "collection": col}
        print(f"{sub:16s} {len(rows):3d} 篇  collection={col[0] if col else '?'}")
    con.close()

    # Find existing index notes so re-runs update instead of duplicating.
    init, sid = mcp({"jsonrpc": "2.0", "id": 1, "method": "initialize",
                     "params": {"protocolVersion": "2024-11-05", "capabilities": {},
                                "clientInfo": {"name": "batch", "version": "1"}}})
    mcp({"jsonrpc": "2.0", "method": "notifications/initialized"}, sid)

    # Locate existing index notes straight from the database: Zotero's search
    # index does not match a note whose first line is a Markdown heading.
    existing = {}
    con2 = sqlite3.connect(f"file:{snapshot()}?mode=ro", uri=True)
    for key, note in con2.execute("""
        SELECT i.key, n.note FROM items i
        JOIN itemNotes n ON n.itemID = i.itemID
        WHERE n.parentItemID IS NULL
          AND NOT EXISTS (SELECT 1 FROM deletedItems d WHERE d.itemID = i.itemID)
    """):
        m = re.search(r"分类索引：([^<\n]+)", note or "")
        if m:
            existing[m.group(1).strip()] = key
    con2.close()
    print(f"\n已有索引笔记: {existing}")

    if not args.apply:
        print("\ndry run; pass --apply to write")
        return 0

    for sub, data in plan.items():
        note = build(sub, data["rows"])
        title_key = existing.get(sub)
        if title_key:
            call(sid, "write_note", {"action": "update", "noteKey": title_key,
                                     "content": note})
            key = title_key
            action = "updated"
        else:
            res = call(sid, "write_note", {"action": "create", "content": note})
            key = res.get("data", {}).get("noteKey")
            action = "created"
        if not key:
            print(f"  {sub}: FAILED {res}")
            continue
        if data["collection"]:
            call(sid, "add_items_to_collection",
                 {"collectionKey": data["collection"][1], "itemKeys": [key]})
        call(sid, "write_tag", {"action": "add", "itemKey": key, "tags": [TAG]})
        print(f"  {sub:16s} {action} {key}  ({len(note)} chars)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
