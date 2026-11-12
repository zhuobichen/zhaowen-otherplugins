"""Compress Natural Earth 110m country outlines into a compact JS literal.

The raw GeoJSON is 819 KB, mostly repeated property keys the map never reads.
This keeps only geometry, rounded to 2 decimals (about 1 km at the equator,
already finer than a 1440 px canvas can show), and encodes each ring as a flat
[lon,lat,lon,lat,...] array.

Output shape:  [[name_zh, name_en, [ring, ring, ...]], ...]
A country with islands has several rings; one ring is one closed polygon.
"""
from __future__ import annotations

import json
from pathlib import Path

SRC = Path(r"E:\CodeProject\其余工程\_world_110m.geojson")
OUT = Path(r"E:\CodeProject\其余工程\_world_compact.json")

# Antarctica is never in a study area and eats a third of the file.
SKIP = {"Antarctica"}


def round_ring(ring, nd=2):
    out = []
    for lon, lat, *_ in ring:
        lon = round(lon, nd)
        lat = round(lat, nd)
        if out and out[-2] == lon and out[-1] == lat:
            continue  # collapse duplicate vertices
        out.extend([lon, lat])
    return out


def main():
    data = json.loads(SRC.read_text(encoding="utf-8"))
    countries = []
    for feat in data["features"]:
        props = feat["properties"]
        name_en = props.get("NAME") or ""
        if name_en in SKIP:
            continue
        name_zh = props.get("NAME_ZH") or name_en
        geo = feat["geometry"]
        if not geo:
            continue
        gtype = geo["type"]
        coords = geo["coordinates"]

        if gtype == "Polygon":
            rings = [round_ring(r) for r in coords]
        elif gtype == "MultiPolygon":
            rings = []
            for poly in coords:
                rings.extend(round_ring(r) for r in poly)
        else:
            continue

        # Drop specks: fewer than 4 points cannot describe an area.
        rings = [r for r in rings if len(r) >= 8]
        if not rings:
            continue
        countries.append([name_zh, name_en, rings])

    OUT.write_text(json.dumps(countries, ensure_ascii=False,
                              separators=(",", ":")), encoding="utf-8")
    size = OUT.stat().st_size
    pts = sum(len(r) // 2 for c in countries for r in c[2])
    print(f"countries {len(countries)}")
    print(f"points    {pts}")
    print(f"output    {size/1024:.0f} KB  -> {OUT}")
    print(f"sample    {countries[0][0]} / {countries[0][1]}  rings={len(countries[0][2])}")


if __name__ == "__main__":
    main()
