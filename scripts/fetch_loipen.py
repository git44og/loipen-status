#!/usr/bin/env python3
"""Lädt Loipenverläufe (piste:type=nordic) aus OpenStreetMap via Overpass API
und schreibt sie als GeoJSON.

Beispiele:
  python3 scripts/fetch_loipen.py --area "Oberstdorf" -o data/loipen.geojson
  python3 scripts/fetch_loipen.py --bbox 47.2,10.0,47.6,10.6 -o data/loipen.geojson

Daten: © OpenStreetMap-Mitwirkende, Lizenz ODbL (https://www.openstreetmap.org/copyright)
"""
import argparse
import json
import sys
import urllib.parse
import urllib.request

OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
KEEP_TAGS = (
    "name", "ref", "piste:type", "piste:grooming", "piste:difficulty",
    "piste:lit", "piste:name", "piste:ref", "surface", "access", "operator",
    "website", "description",
)


def build_query(area, bbox):
    if area:
        scope = f'area["name"="{area}"]["boundary"="administrative"]->.a;'
        flt = "(area.a)"
    else:
        scope = ""
        flt = f"({bbox})"
    return f"""[out:json][timeout:180];
{scope}
(
  way["piste:type"="nordic"]{flt};
  relation["piste:type"="nordic"]{flt};
);
out tags geom;"""


def fetch(query):
    data = urllib.parse.urlencode({"data": query}).encode()
    last = None
    for url in OVERPASS_URLS:
        try:
            req = urllib.request.Request(url, data=data, headers={"User-Agent": "loipen-status/0.1"})
            with urllib.request.urlopen(req, timeout=240) as r:
                return json.load(r)
        except Exception as e:  # nächsten Mirror versuchen
            last = e
            print(f"{url}: {e}", file=sys.stderr)
    raise SystemExit(f"Alle Overpass-Server fehlgeschlagen: {last}")


def line(geom):
    return [[p["lon"], p["lat"]] for p in geom]


def to_feature(el):
    props = {k: el["tags"][k] for k in KEEP_TAGS if k in el.get("tags", {})}
    props["osm_id"] = f'{el["type"]}/{el["id"]}'
    if el["type"] == "way" and el.get("geometry"):
        geom = {"type": "LineString", "coordinates": line(el["geometry"])}
    elif el["type"] == "relation":
        lines = [line(m["geometry"]) for m in el.get("members", []) if m.get("geometry")]
        if not lines:
            return None
        geom = {"type": "MultiLineString", "coordinates": lines}
    else:
        return None
    return {"type": "Feature", "properties": props, "geometry": geom}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--area", help="Name eines Verwaltungsgebiets, z. B. 'Oberstdorf'")
    g.add_argument("--bbox", help="süd,west,nord,ost")
    ap.add_argument("-o", "--out", default="loipen.geojson")
    a = ap.parse_args()

    elements = fetch(build_query(a.area, a.bbox))["elements"]
    feats = [f for f in map(to_feature, elements) if f]
    fc = {
        "type": "FeatureCollection",
        "attribution": "© OpenStreetMap contributors, ODbL",
        "features": feats,
    }
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(fc, f, ensure_ascii=False)
    print(f"{len(feats)} Loipen-Objekte -> {a.out}")


if __name__ == "__main__":
    main()
