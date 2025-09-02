# backend/services/data_fetch.py
import os, requests
from typing import Any, Dict, List

DATASETS = {
    "buildings_3d": "cchr-krqg",   # 3D buildings
    "buildings_2d": "uc4c-6kbd",   # 2D footprints
    "land_use": "qe6k-p9nh",       # zoning polygons
    "assessments": "4bsw-nn7w"     # parcel assessments
}

APP_TOKEN = os.environ.get("SOCRATA_APP_TOKEN")
HEADERS = {"X-App-Token": APP_TOKEN} if APP_TOKEN else {}
CANDIDATE_GEOMS = ["geometry", "the_geom", "shape", "geom", "multipolygon"]

def _safe_get(url, params):
    try:
        r = requests.get(url, params=params, headers=HEADERS, timeout=30)
        r.raise_for_status()
        return r.json()
    except Exception:
        return {"type": "FeatureCollection", "features": []}

def socrata_geojson(dataset_id: str, minLon: float, minLat: float, maxLon: float, maxLat: float, limit=5000):
    """
    Socrata within_box expects: (north_lat, west_lon, south_lat, east_lon),
    and field name varies by dataset.
    """
    north, south = maxLat, minLat
    west,  east  = minLon, maxLon

    base = f"https://data.calgary.ca/resource/{dataset_id}.geojson"
    for field in CANDIDATE_GEOMS:
        params = {
            "$limit": limit,
            "$where": f"within_box({field}, {north}, {west}, {south}, {east})"
        }
        data = _safe_get(base, params)
        feats = data.get("features") or []
        if feats:
            return data
    return {"type": "FeatureCollection", "features": []}

def fetch_buildings_bbox(bbox: str) -> List[Dict[str, Any]]:
    minLon, minLat, maxLon, maxLat = [float(x) for x in bbox.split(",")]
    # Try 3D first
    gj3 = socrata_geojson(DATASETS["buildings_3d"], minLon, minLat, maxLon, maxLat)
    feats = gj3.get("features") or []
    if feats:
        return feats
    # Fallback to 2D
    gj2 = socrata_geojson(DATASETS["buildings_2d"], minLon, minLat, maxLon, maxLat)
    return gj2.get("features") or []

def fetch_land_use_bbox(bbox: str) -> List[Dict[str, Any]]:
    minLon, minLat, maxLon, maxLat = [float(x) for x in bbox.split(",")]
    gj = socrata_geojson(DATASETS["land_use"], minLon, minLat, maxLon, maxLat)
    return gj.get("features") or []

def fetch_assessments_bbox(bbox: str) -> List[Dict[str, Any]]:
    minLon, minLat, maxLon, maxLat = [float(x) for x in bbox.split(",")]
    gj = socrata_geojson(DATASETS["assessments"], minLon, minLat, maxLon, maxLat)
    return gj.get("features") or []

def _first(props: dict, keys: List[str], default=None):
    for k in keys:
        v = props.get(k)
        if v not in (None, ""):
            return v
    return default

def norm_building(f):
    """Normalize a Calgary footprint feature into our schema."""
    props = f.get("properties", {}) or {}
    geom  = f.get("geometry")

    # Try a bunch of likely keys for height (meters)
    height_candidates = [
        "height_m", "HEIGHT_M", "height", "building_height", "bldg_height_m"
    ]
    height_m = None
    for k in height_candidates:
        v = props.get(k)
        if v is None:
            continue
        try:
            height_m = float(v)
            break
        except Exception:
            pass

    # Try to infer from levels / storeys if present
    level_candidates = [
        "levels", "LEVELS", "storeys", "stories", "num_storeys", "number_of_storeys"
    ]
    levels = None
    for k in level_candidates:
        v = props.get(k)
        if v is None:
            continue
        try:
            levels = int(float(v))
            break
        except Exception:
            pass

    # If no explicit height, estimate from levels
    if height_m is None and levels is not None:
        height_m = levels * 3.0  # simple assumption: ~3 m per level

    # Final fallback for pure 2D footprints
    if height_m is None:
        height_m = 12.0

    return {
        "id": props.get("objectid") or props.get("id") or props.get("OBJECTID") or props.get("bldg_id") or props.get("BLDG_ID") or props.get("mapid") or props.get("MAPID"),
        "geometry": geom,
        "height_m": float(height_m),
        "levels": levels if levels is not None else round(float(height_m)/3.0),
        "address": props.get("address") or props.get("ADDRESS") or props.get("civic_address"),
        "zoning": props.get("zoning") or props.get("ZONING") or props.get("land_use") or props.get("LAND_USE"),
        "assessed_value": None,  # filled later by assessment overlay
        "raw": props,
    }


def norm_land_use(f):
    p = f.get("properties") or {}
    g = f.get("geometry")
    z = None
    for k in p.keys():
        if k.lower() in ["land_use_district","landuse_district","landuse","district","zone","zoning"]:
            z = p.get(k); break
    return {"zoning": z or "Unknown", "geometry": g, "raw": p}

def norm_assess(f):
    p = f.get("properties") or {}
    g = f.get("geometry")
    val = None
    for k,v in p.items():
        kl = str(k).lower()
        if "assessed" in kl and ("value" in kl or "total" in kl):
            try:
                val = float(str(v).replace(",","")); break
            except Exception:
                pass
    addr = _first(p, ["address","street_address","situs_addr"], "Unknown")
    return {"assessed_value": val, "address": addr, "geometry": g, "raw": p}
