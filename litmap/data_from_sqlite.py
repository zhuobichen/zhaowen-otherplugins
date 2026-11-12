"""Collect the data the map HTML needs, from Zotero plus OpenCitations.

Four views are built from one dataset:

  * relationship graph   edges are citations between two items that are BOTH in
                         the library ("how does my library cite itself"), the
                         only edge type that is verifiable rather than inferred
  * semantic map         TF-IDF over title + note, then 2-D projection
  * time x category      year against the assigned sub-collection
  * geographic map       research regions recognised in title and note

Outputs ``_mapdata.json`` next to this script; the plugin embeds the same
shapes, so this file doubles as the fixture used to develop the HTML.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sqlite3
import tempfile
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ZOT = Path(r"E:\CodeProject\Zotero")
OUT = Path(r"E:\CodeProject\其余工程\_mapdata.json")
CITE_CACHE = Path(r"E:\CodeProject\其余工程\_openCitations_cache.json")
UA = {"User-Agent": "zotero-map/1.0 (mailto:research@example.org)"}

# Region lexicon: the study areas that actually occur in this library.
REGIONS = {
    "CONUS": [r"\bconus\b", r"contiguous united states", r"continental united states",
              r"\bu\.?s\.?\b", r"united states", r"\busa\b", r"american"],
    "中国": [r"\bchina\b", r"chinese", r"中国", r"全国"],
    "京津冀": [r"beijing", r"tianjin", r"hebei", r"北京", r"京津冀"],
    "长三角": [r"yangtze river delta", r"yangtze", r"长三角"],
    "珠三角": [r"pearl river delta", r"prd\b", r"珠三角"],
    "汾渭平原": [r"fenwei", r"fenwei plain", r"汾渭"],
    "欧洲": [r"\beurope\b", r"european", r"欧洲"],
    "英国/爱尔兰": [r"\buk\b", r"britain", r"england", r"ireland", r"dublin", r"london"],
    "印度": [r"\bindia\b", r"delhi", r"印度"],
    "东南亚": [r"jakarta", r"malaysia", r"taiwan", r"kuala lumpur", r"thailand",
               r"vietnam", r"东南亚"],
    "韩国/日本": [r"korea", r"\bjapan\b", r"seoul", r"tokyo"],
    "加拿大": [r"canada", r"quebec", r"ontario", r"加拿大"],
    "意大利": [r"italy", r"italian", r"lombardy", r"po valley", r"意大利"],
    "中东": [r"iran", r"iraq", r"saudi", r"middle east", r"伊朗"],
    "澳洲": [r"australia", r"new zealand", r"澳洲"],
    "非洲": [r"africa", r"非洲"],
    "南美": [r"brazil", r"south america", r"巴西"],
}


def snapshot() -> Path:
    tmp = Path(tempfile.gettempdir()) / "zt_map"
    tmp.mkdir(exist_ok=True)
    for suffix in ("", "-wal", "-shm"):
        src = ZOT / ("zotero.sqlite" + suffix)
        if src.exists():
            shutil.copy2(src, tmp / ("zotero.sqlite" + suffix))
    return tmp / "zotero.sqlite"


def plain(html, limit=1400):
    if not html:
        return ""
    text = re.sub(r"<[^>]+>", " ", html)
    text = text.replace("&nbsp;", " ").replace("&amp;", "&").replace("&gt;", ">")
    return re.sub(r"\s+", " ", text).strip()[:limit]


def gather():
    con = sqlite3.connect(f"file:{snapshot()}?mode=ro", uri=True)
    cur = con.cursor()

    sub_of = {}
    for cid, name, parent in cur.execute(
        "SELECT collectionID, collectionName, IFNULL(parentCollectionID,0) FROM collections"):
        if parent:
            sub_of[cid] = name

    rows = cur.execute(
        """
        SELECT i.itemID, i.key, it.typeName,
          (SELECT idv.value FROM itemData d JOIN itemDataValues idv ON idv.valueID=d.valueID
             JOIN fields f ON f.fieldID=d.fieldID
           WHERE d.itemID=i.itemID AND f.fieldName='title'),
          (SELECT idv.value FROM itemData d JOIN itemDataValues idv ON idv.valueID=d.valueID
             JOIN fields f ON f.fieldID=d.fieldID
           WHERE d.itemID=i.itemID AND f.fieldName='date'),
          (SELECT idv.value FROM itemData d JOIN itemDataValues idv ON idv.valueID=d.valueID
             JOIN fields f ON f.fieldID=d.fieldID
           WHERE d.itemID=i.itemID AND f.fieldName='DOI'),
          (SELECT idv.value FROM itemData d JOIN itemDataValues idv ON idv.valueID=d.valueID
             JOIN fields f ON f.fieldID=d.fieldID
           WHERE d.itemID=i.itemID AND f.fieldName='extra'),
          (SELECT idv.value FROM itemData d JOIN itemDataValues idv ON idv.valueID=d.valueID
             JOIN fields f ON f.fieldID=d.fieldID
           WHERE d.itemID=i.itemID AND f.fieldName='abstractNote')
        FROM items i JOIN itemTypes it ON it.itemTypeID=i.itemTypeID
        WHERE it.typeName NOT IN ('note','attachment','annotation')
          AND NOT EXISTS (SELECT 1 FROM deletedItems di WHERE di.itemID=i.itemID)
        """
    ).fetchall()

    items = []
    for iid, key, tp, title, date, doi, extra, abstract in rows:
        cols = [sub_of[c] for c in
                (r[0] for r in cur.execute(
                    "SELECT collectionID FROM collectionItems WHERE itemID=?", (iid,)))
                if c in sub_of]
        row = cur.execute(
            "SELECT note FROM itemNotes WHERE parentItemID=? LIMIT 1", (iid,)).fetchone()
        note = row[0] if row else ""
        cited = re.search(r"Citations:\s*(\d+)", extra or "")
        year = re.search(r"(?:19|20)\d{2}", date or "")
        items.append({
            "key": key,
            "title": plain(title, 300),
            "year": int(year.group(0)) if year else None,
            "doi": (doi or "").lower().strip(),
            "collection": cols[0] if cols else "",
            "type": tp,
            "cited": int(cited.group(1)) if cited else None,
            "text": (plain(abstract) + " " + plain(note)).strip()[:1600],
        })
    con.close()
    return items


def citations_for(doi):
    """Referenced DOIs for one DOI, via OpenCitations COCI."""
    url = f"https://opencitations.net/index/coci/api/v1/references/{doi}"
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.load(resp)
        return [row["cited"].lower() for row in data if row.get("cited")]
    except Exception:
        return []


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skip-citations", action="store_true")
    args = parser.parse_args()

    items = gather()
    print(f"条目 {len(items)}（有 DOI {sum(1 for i in items if i['doi'])}）")

    # Region tagging.
    for item in items:
        blob = (item["title"] + " " + item["text"]).lower()
        hits = []
        for name, pats in REGIONS.items():
            if any(re.search(p, blob, re.I) for p in pats):
                hits.append(name)
        item["regions"] = hits

    # Citation edges among library items.
    edges = []
    cache = {}
    if CITE_CACHE.exists():
        cache = json.loads(CITE_CACHE.read_text(encoding="utf-8"))
    if not args.skip_citations:
        dois = [i["doi"] for i in items if i["doi"].startswith("10.")]
        todo = [d for d in dois if d not in cache]
        print(f"查引用关系: {len(todo)} 个 DOI（缓存 {len(dois)-len(todo)}）")
        done = 0
        with ThreadPoolExecutor(max_workers=4) as pool:
            for doi, refs in zip(todo, pool.map(citations_for, todo)):
                cache[doi] = refs
                done += 1
                if done % 25 == 0:
                    print(f"  ...{done}/{len(todo)}")
        CITE_CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")

    by_doi = {i["doi"]: i["key"] for i in items if i["doi"]}
    for doi, refs in cache.items():
        src = by_doi.get(doi)
        if not src:
            continue
        for ref in refs:
            dst = by_doi.get(ref)
            if dst and dst != src:
                edges.append({"source": src, "target": dst})
    # Deduplicate (A->B and B->A are different claims; keep both).
    seen = set()
    uniq = []
    for e in edges:
        k = (e["source"], e["target"])
        if k not in seen:
            seen.add(k)
            uniq.append(e)
    edges = uniq
    print(f"库内引用边: {len(edges)}")

    OUT.write_text(json.dumps({"items": items, "edges": edges},
                              ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"写出 {OUT}  ({OUT.stat().st_size/1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
