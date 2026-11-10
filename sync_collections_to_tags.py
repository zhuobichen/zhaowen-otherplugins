#!/usr/bin/env python3
"""Mirror Zotero collection membership into tags.

Why tags rather than a plugin column: Zotero 10.0.8 registers a plugin column
(`registerColumn` returns a key) but never puts it into the tree's rendered
column list, and hand-editing ``treePrefs.json`` does not help either. The
native **Tags** column always renders, is filterable and sortable, and needs no
add-on.

Tag format: ``分类/方法/统计地统计`` -- one tag per leaf collection an item
belongs to. The ``分类/`` prefix keeps these apart from ordinary topical tags
and makes them findable with a single search.

Design rules
------------
- Only LEAF collections are mirrored. A parent that holds sub-collections is a
  grouping container; its name adds nothing the child name does not already say.
- Sync is idempotent and one-way: it adds missing ``分类/`` tags and removes
  ``分类/`` tags that no longer match a membership. Ordinary tags are never
  touched.
- ``--apply`` writes; the default is a dry run with a full diff.

Zotero must be closed: the database takes an exclusive lock while open.
"""
from __future__ import annotations

import argparse
import csv
import os
import shutil
import sqlite3
import subprocess
import sys
import time

ZOTERO_DIR = r"E:\CodeProject\Zotero"
DB = os.path.join(ZOTERO_DIR, "zotero.sqlite")
BACKUP_DIR = r"E:\CodeProject\其余工程\_zotero_backup_tags_20261110"
CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_tag_snapshot")

TAG_PREFIX = "分类"


def zotero_running() -> bool:
    try:
        out = subprocess.run(["tasklist", "/FI", "IMAGENAME eq zotero.exe"],
                             capture_output=True, text=True, timeout=15).stdout
        return "zotero.exe" in out.lower()
    except Exception:  # noqa: BLE001
        return False


def snapshot() -> str:
    """Copy the database plus its WAL so uncommitted rows are visible."""
    os.makedirs(CACHE_DIR, exist_ok=True)
    for suffix in ("", "-wal", "-shm"):
        source = DB + suffix
        if os.path.exists(source):
            shutil.copy2(source, os.path.join(CACHE_DIR, "zotero.sqlite" + suffix))
    return os.path.join(CACHE_DIR, "zotero.sqlite")


def build_plan(connection: sqlite3.Connection):
    """Return (desired: itemID -> set(tag), current: itemID -> set(tag))."""
    cursor = connection.cursor()

    # Leaf collections only: a collection with children is a container.
    collections = {}
    for cid, name, parent in cursor.execute(
        "SELECT collectionID, collectionName, IFNULL(parentCollectionID, 0) FROM collections"
    ):
        collections[cid] = {"name": name, "parent": parent, "is_leaf": True}
    for entry in collections.values():
        if entry["parent"] in collections:
            collections[entry["parent"]]["is_leaf"] = False

    # Desired tags per item, from collection membership.
    desired = {}
    rows = cursor.execute(
        "SELECT ci.itemID, ci.collectionID FROM collectionItems ci "
        "JOIN items i ON i.itemID = ci.itemID "
        "JOIN itemTypes it ON it.itemTypeID = i.itemTypeID "
        "WHERE it.typeName NOT IN ('attachment','note','annotation')"
    ).fetchall()
    for item_id, cid in rows:
        entry = collections.get(cid)
        if not entry or not entry["is_leaf"]:
            continue
        desired.setdefault(item_id, set()).add(f"{TAG_PREFIX}/{entry['name']}")

    # Current tags, restricted to our prefix.
    current = {}
    rows = cursor.execute(
        "SELECT it.itemID, t.name FROM itemTags it "
        "JOIN tags t ON t.tagID = it.tagID "
        "JOIN items i ON i.itemID = it.itemID "
        "JOIN itemTypes ty ON ty.itemTypeID = i.itemTypeID "
        "WHERE ty.typeName NOT IN ('attachment','note','annotation')"
    ).fetchall()
    for item_id, name in rows:
        if name.startswith(TAG_PREFIX + "/"):
            current.setdefault(item_id, set()).add(name)

    return desired, current


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--force", action="store_true",
                        help="write even if Zotero appears to be running")
    args = parser.parse_args()

    if zotero_running() and not args.force:
        print("ERROR: Zotero is running. Close it first (the DB takes an")
        print("       exclusive lock, and writes would be lost on exit).")
        return 1

    path = snapshot()
    connection = sqlite3.connect(path)
    desired, current = build_plan(connection)

    all_items = set(desired) | set(current)
    to_add, to_remove = [], []
    for item_id in all_items:
        want = desired.get(item_id, set())
        have = current.get(item_id, set())
        for tag in want - have:
            to_add.append((item_id, tag))
        for tag in have - want:
            to_remove.append((item_id, tag))

    print(f"items with a leaf collection : {len(desired)}")
    print(f"items already carrying {TAG_PREFIX}/ tags : {len(current)}")
    print(f"tags to add                  : {len(to_add)}")
    print(f"tags to remove               : {len(to_remove)}")

    if to_add:
        print("\n--- sample additions ---")
        for item_id, tag in to_add[:5]:
            print(f"  item {item_id}: +{tag}")
    if to_remove:
        print("\n--- sample removals ---")
        for item_id, tag in to_remove[:5]:
            print(f"  item {item_id}: -{tag}")

    # Distinct tag values, useful to see the vocabulary being created.
    values = sorted({tag for tags in desired.values() for tag in tags})
    print(f"\ndistinct {TAG_PREFIX}/ tags: {len(values)}")
    for value in values:
        print(f"  {value}")

    connection.close()

    if not args.apply:
        print("\ndry run; pass --apply to write")
        return 0

    os.makedirs(BACKUP_DIR, exist_ok=True)
    for suffix in ("", "-wal", "-shm"):
        source = DB + suffix
        if os.path.exists(source):
            shutil.copy2(source, os.path.join(BACKUP_DIR, "zotero.sqlite" + suffix))
    print(f"\nbacked up to {BACKUP_DIR}")

    connection = sqlite3.connect(DB)
    try:
        connection.execute("BEGIN IMMEDIATE")
        cursor = connection.cursor()

        # Tag names are shared across items; reuse the existing tagID.
        def tag_id(name: str) -> int:
            row = cursor.execute("SELECT tagID FROM tags WHERE name = ?", (name,)).fetchone()
            if row:
                return row[0]
            cursor.execute("INSERT INTO tags (name) VALUES (?)", (name,))
            return cursor.lastrowid

        for item_id, tag in to_add:
            tid = tag_id(tag)
            exists = cursor.execute(
                "SELECT 1 FROM itemTags WHERE itemID = ? AND tagID = ?", (item_id, tid)
            ).fetchone()
            if not exists:
                cursor.execute("INSERT INTO itemTags (itemID, tagID, type) VALUES (?, ?, 0)",
                               (item_id, tid))
        for item_id, tag in to_remove:
            row = cursor.execute("SELECT tagID FROM tags WHERE name = ?", (tag,)).fetchone()
            if row:
                cursor.execute("DELETE FROM itemTags WHERE itemID = ? AND tagID = ?",
                               (item_id, row[0]))
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

    print(f"committed: +{len(to_add)} -{len(to_remove)}")

    # Verification pass on a fresh snapshot.
    connection = sqlite3.connect(snapshot())
    desired2, current2 = build_plan(connection)
    remaining = sum(len(desired2.get(i, set()) - current2.get(i, set())) for i in desired2)
    extra = sum(len(current2.get(i, set()) - desired2.get(i, set())) for i in current2)
    print(f"verify: missing={remaining}  stale={extra}")
    connection.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
