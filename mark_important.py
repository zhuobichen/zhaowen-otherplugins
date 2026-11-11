"""Mark or unmark items as important with the ``▲`` tag.

The Collection Tags column renders ``▲`` as a red chip ahead of the category
labels, so this tag needs no separate column turn on.

Usage:
    python mark_important.py --list                 # show what is marked
    python mark_important.py --add K1 K2 K3         # mark items
    python mark_important.py --remove K1            # unmark
    python mark_important.py --collections 深度学习  # mark a whole sub-collection
    python mark_important.py --collections 深度学习 --remove

Item keys are the 8-character Zotero keys shown in the column's tooltip and in
``zotero://select/library/items/<KEY>`` links.
"""
from __future__ import annotations

import argparse
import json
import sqlite3
import shutil
import tempfile
import urllib.request
from pathlib import Path

ZOT = Path(r"E:\CodeProject\Zotero")
MCP_URL = "http://127.0.0.1:23120/mcp"
TAG = "▲"


def snapshot() -> Path:
    tmp = Path(tempfile.gettempdir()) / "zt_mark"
    tmp.mkdir(exist_ok=True)
    for suffix in ("", "-wal", "-shm"):
        src = ZOT / ("zotero.sqlite" + suffix)
        if src.exists():
            shutil.copy2(src, tmp / ("zotero.sqlite" + suffix))
    return tmp / "zotero.sqlite"


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
    res, _ = mcp({"jsonrpc": "2.0", "id": 5, "method": "tools/call",
                  "params": {"name": tool, "arguments": arguments}}, session)
    text = res.get("result", {}).get("content", [{}])[0].get("text", "{}")
    try:
        return json.loads(text)
    except Exception:
        return {"raw": text}


def items_in(collection_name):
    con = sqlite3.connect(f"file:{snapshot()}?mode=ro", uri=True)
    rows = con.execute(
        """
        SELECT i.key,
          (SELECT idv.value FROM itemData id
             JOIN itemDataValues idv ON idv.valueID = id.valueID
             JOIN fields f ON f.fieldID = id.fieldID
           WHERE id.itemID = i.itemID AND f.fieldName = 'title') AS title
        FROM collections c
        JOIN collectionItems ci ON ci.collectionID = c.collectionID
        JOIN items i ON i.itemID = ci.itemID
        JOIN itemTypes it ON it.itemTypeID = i.itemTypeID
        WHERE c.collectionName = ? AND it.typeName <> 'note'
        ORDER BY title
        """,
        (collection_name,),
    ).fetchall()
    con.close()
    return rows


def marked():
    con = sqlite3.connect(f"file:{snapshot()}?mode=ro", uri=True)
    rows = con.execute(
        """
        SELECT i.key,
          (SELECT idv.value FROM itemData id
             JOIN itemDataValues idv ON idv.valueID = id.valueID
             JOIN fields f ON f.fieldID = id.fieldID
           WHERE id.itemID = i.itemID AND f.fieldName = 'title') AS title
        FROM items i
        JOIN itemTags it ON it.itemID = i.itemID
        JOIN tags t ON t.tagID = it.tagID
        WHERE t.name = ?
        ORDER BY title
        """,
        (TAG,),
    ).fetchall()
    con.close()
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--list", action="store_true")
    parser.add_argument("--add", nargs="*", default=None)
    parser.add_argument("--remove", nargs="*", default=None)
    parser.add_argument("--collections", nargs="*", default=None,
                        help="collection names to operate on as a group")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    if args.list or (not args.add and not args.remove and not args.collections):
        rows = marked()
        print(f"已标记 ▲ 的条目：{len(rows)}")
        for key, title in rows:
            print(f"  {key}  {(title or '')[:70]}")
        return 0

    targets = []
    if args.collections:
        for name in args.collections:
            found = items_in(name)
            print(f"{name}: {len(found)} 篇")
            targets.extend(k for k, _ in found)
    if args.add:
        targets.extend(args.add)
    removing = bool(args.remove)
    if args.remove:
        targets.extend(args.remove)

    targets = sorted(set(targets))
    action = "remove" if removing else "add"
    print(f"将 {action} 标签 {TAG} → {len(targets)} 个条目")

    if not args.apply:
        print("\ndry run; pass --apply to write")
        return 0

    init, sid = mcp({"jsonrpc": "2.0", "id": 1, "method": "initialize",
                     "params": {"protocolVersion": "2024-11-05", "capabilities": {},
                                "clientInfo": {"name": "mark", "version": "1"}}})
    mcp({"jsonrpc": "2.0", "method": "notifications/initialized"}, sid)

    ok = fail = 0
    for key in targets:
        res = call(sid, "write_tag", {"action": action, "itemKey": key, "tags": [TAG]})
        if res.get("success") is False:
            fail += 1
            print(f"  FAILED {key}: {str(res)[:100]}")
        else:
            ok += 1
    print(f"\n完成: 成功 {ok}  失败 {fail}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
