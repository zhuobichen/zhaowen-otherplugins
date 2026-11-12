"""Build the geometry file the map highlights: country outlines plus China
province outlines, and the mapping from a研究区域 name to the shapes it covers.

Why two layers
--------------
The library tags regions at two granularities: whole countries/regions
(中国, CONUS, 欧洲, 印度 …) and Chinese sub-national areas (京津冀, 长三角,
珠三角, 汾渭平原). Natural Earth 110m has the former; the latter need
province-level polygons, which come from DataV's China boundary file.

Output: litmap/content/regions.json
    {
      "countries": {name: [ring, ring, ...]},   ring = [lon,lat,lon,lat,...]
      "provinces": {name: [ring, ...]},
      "regions":   {region: {"countries": [...], "provinces": [...]}}
    }
Coordinates are rounded to 2 decimals (~1 km), well past what a 1400 px canvas
can show, and rings with fewer than 4 points are dropped as specks.
"""
from __future__ import annotations

import json
from pathlib import Path

HERE = Path(r"E:\CodeProject\其余工程")
WORLD_SRC = HERE / "_world_110m.geojson"
CHINA_SRC = HERE / "_china_provinces.json"
OUT = HERE / "litmap" / "content" / "regions.json"

# Region -> members. Country names are Natural Earth's NAME field; province
# names are DataV's administrative names.
COUNTRY_REGIONS = {
    "CONUS": ["United States of America"],
    "中国": ["China"],
    "加拿大": ["Canada"],
    "印度": ["India"],
    "韩国/日本": ["South Korea", "Japan"],
    "意大利": ["Italy"],
    "英国/爱尔兰": ["United Kingdom", "Ireland"],
    "澳洲": ["Australia", "New Zealand"],
    "中东": ["Iran", "Iraq", "Saudi Arabia", "Israel", "Jordan", "Kuwait", "Qatar",
             "Oman", "Yemen", "Syria", "Lebanon", "United Arab Emirates", "Turkey"],
    "东南亚": ["Indonesia", "Malaysia", "Thailand", "Vietnam", "Philippines",
               "Myanmar", "Cambodia", "Laos", "Brunei", "Taiwan"],
    "欧洲": ["France", "Germany", "Poland", "Spain", "Portugal", "Italy", "Greece",
             "Netherlands", "Belgium", "Luxembourg", "Switzerland", "Austria",
             "Czechia", "Slovakia", "Hungary", "Slovenia", "Croatia", "Serbia",
             "Bosnia and Herz.", "Montenegro", "Albania", "North Macedonia",
             "Romania", "Bulgaria", "Denmark", "Norway", "Sweden", "Finland",
             "Estonia", "Latvia", "Lithuania", "Belarus", "Ukraine", "Moldova",
             "Ireland", "United Kingdom", "Iceland"],
    "非洲": ["Morocco", "Algeria", "Tunisia", "Libya", "Egypt", "Sudan", "S. Sudan",
             "Ethiopia", "Eritrea", "Djibouti", "Somalia", "Somaliland", "Kenya",
             "Uganda", "Tanzania", "Rwanda", "Burundi", "Nigeria", "Ghana", "Togo",
             "Benin", "Burkina Faso", "Mali", "Niger", "Chad", "Cameroon",
             "Central African Rep.", "Congo", "Dem. Rep. Congo", "Gabon",
             "Eq. Guinea", "Angola", "Zambia", "Malawi", "Mozambique", "Zimbabwe",
             "Botswana", "Namibia", "South Africa", "Lesotho", "eSwatini",
             "Madagascar", "Mauritania", "Senegal", "Gambia", "Guinea",
             "Guinea-Bissau", "Sierra Leone", "Liberia", "Côte d'Ivoire"],
    "南美": ["Brazil", "Argentina", "Chile", "Peru", "Colombia", "Venezuela",
             "Ecuador", "Bolivia", "Paraguay", "Uruguay", "Guyana", "Suriname"],
}

PROVINCE_REGIONS = {
    "京津冀": [110000, 120000, 130000],
    "长三角": [310000, 320000, 330000, 340000],
    "珠三角": [440000, 810000, 820000],
    "汾渭平原": [610000, 140000],
}

# CONUS means the lower 48; Alaska and Hawaii are separate shapes in the same
# country record and would put the centroid in the Pacific.
CONUS_BBOX = (-130.0, 23.0, -66.0, 50.5)


def round_ring(ring, nd=2):
    out = []
    for pt in ring:
        lon, lat = round(pt[0], nd), round(pt[1], nd)
        if out and out[-2] == lon and out[-1] == lat:
            continue
        out.extend([lon, lat])
    return out


def rings_of(geometry):
    """Flatten a Polygon/MultiPolygon geometry into a list of flat rings."""
    if not geometry:
        return []
    coords = geometry["coordinates"]
    if geometry["type"] == "Polygon":
        return [round_ring(r) for r in coords]
    if geometry["type"] == "MultiPolygon":
        out = []
        for poly in coords:
            out.extend(round_ring(r) for r in poly)
        return out
    return []


def ring_centroid(ring):
    """Area-weighted centroid of a flat [lon,lat,...] ring (shoelace)."""
    a = cx = cy = 0.0
    n = len(ring) // 2
    for i in range(n):
        x0, y0 = ring[2 * i], ring[2 * i + 1]
        j = (i + 1) % n
        x1, y1 = ring[2 * j], ring[2 * j + 1]
        cross = x0 * y1 - x1 * y0
        a += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    if abs(a) < 1e-9:
        # degenerate ring: fall back to the mean of its vertices
        xs = ring[0::2]
        ys = ring[1::2]
        return sum(xs) / len(xs), sum(ys) / len(ys)
    a *= 0.5
    return cx / (6 * a), cy / (6 * a)


def main():
    world = json.loads(WORLD_SRC.read_text(encoding="utf-8"))
    countries = {}
    for feat in world["features"]:
        name = feat["properties"].get("NAME")
        if not name:
            continue
        rings = [r for r in rings_of(feat["geometry"]) if len(r) >= 8]
        if rings:
            countries[name] = rings

    # CONUS: keep only the contiguous-shape rings.
    usa = countries.get("United States of America")
    if usa:
        lo0, la0, lo1, la1 = CONUS_BBOX
        keep = []
        for r in usa:
            c = ring_centroid(r)
            if lo0 <= c[0] <= lo1 and la0 <= c[1] <= la1:
                keep.append(r)
        countries["__CONUS__"] = keep

    china = json.loads(CHINA_SRC.read_text(encoding="utf-8"))
    provinces = {}
    by_adcode = {}
    for feat in china["features"]:
        props = feat["properties"]
        code = props.get("adcode")
        name = props.get("name")
        rings = [r for r in rings_of(feat["geometry"]) if len(r) >= 8]
        if not rings:
            continue
        by_adcode[code] = name
        provinces[name] = rings

    # Region map
    regions = {}
    for region, members in COUNTRY_REGIONS.items():
        present = [m for m in members if m in countries]
        if region == "CONUS":
            present = ["__CONUS__"]
        missing = [m for m in members if m not in countries]
        if missing:
            print(f"  {region}: missing {missing}")
        if present:
            regions[region] = {"countries": present}

    for region, codes in PROVINCE_REGIONS.items():
        names = [by_adcode[c] for c in codes if c in by_adcode]
        absent = [c for c in codes if c not in by_adcode]
        if absent:
            print(f"  {region}: missing adcodes {absent}")
        if names:
            regions[region] = {"provinces": names}

    # Ship every country: the same file doubles as the base map, so the plugin
    # and the HTML only need to load one dataset.
    used_provinces = {p for r in regions.values() for p in r.get("provinces", [])}
    payload = {
        "countries": countries,
        "provinces": {k: provinces[k] for k in used_provinces if k in provinces},
        "regions": regions,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False,
                              separators=(",", ":")), encoding="utf-8")

    size = OUT.stat().st_size
    ncountry = len(payload["countries"])
    nprov = len(payload["provinces"])
    nring = sum(len(v) for v in payload["countries"].values()) + \
        sum(len(v) for v in payload["provinces"].values())
    print(f"\nregions  {len(regions)}")
    print(f"countries {ncountry}  provinces {nprov}  rings {nring}")
    print(f"output   {size/1024:.0f} KB -> {OUT}")


if __name__ == "__main__":
    main()
