"""Extrae únicamente CO/US de Natural Earth; no interviene en runtime ni build."""

import collections
import json
from pathlib import Path
import urllib.request

COMMIT = "ca96624a56bd078437bca8184e78163e5039ad19"
SOURCE = f"https://raw.githubusercontent.com/nvkelso/natural-earth-vector/{COMMIT}/geojson/ne_10m_admin_0_countries.geojson"


def country(feature):
    properties = feature["properties"]
    if properties.get("ADM0_A3") == "COL":
        return "CO"
    if properties.get("SOV_A3") == "US1":
        return "US"
    return None


def polygons(feature):
    geometry = feature["geometry"]
    return geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]


def edges(feature):
    for polygon in polygons(feature):
        for ring in polygon:
            yield from zip(ring, ring[1:])


def edge_key(a, b):
    return tuple(sorted((tuple(a), tuple(b))))


with urllib.request.urlopen(SOURCE, timeout=30) as response:
    features = json.load(response)["features"]

neighbors = collections.defaultdict(set)
for feature in features:
    for a, b in edges(feature):
        neighbors[edge_key(a, b)].add(country(feature) or "other")

result = {"CO": [], "US": [], "borders": {"CO": [], "US": []}}
for feature in features:
    target = country(feature)
    if target is None:
        continue
    result[target].extend(polygons(feature))
    for a, b in edges(feature):
        if neighbors[edge_key(a, b)] - {target}:
            result["borders"][target].append([a, b])

destination = Path(__file__).resolve().parents[1] / "src/data/emergency-country-boundaries.json"
destination.write_text(json.dumps(result, separators=(",", ":")) + "\n")
print(f"Natural Earth {COMMIT}: {destination.name} ({destination.stat().st_size} bytes)")
