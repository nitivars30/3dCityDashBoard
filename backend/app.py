import os, json
try:
    import config as cfg  # backend/config.py
    for key in ("HF_API_KEY", "HF_MODEL", "SOCRATA_APP_TOKEN", "DATABASE_URL"):
        val = getattr(cfg, key, None)
        if val is not None and os.environ.get(key) is None:
            os.environ[key] = str(val)
except ImportError:
    pass
from flask import Flask, request, jsonify
from flask_cors import CORS
from sqlalchemy import select
from shapely.geometry import shape
from shapely.strtree import STRtree

from db import init_db, SessionLocal, User, Project
from models import SaveProjectRequest, LoadProjectRequest, LLMQueryRequest, FilterRequest
from services.llm import parse_filters
from services.data_fetch import (
    fetch_buildings_bbox, fetch_land_use_bbox, fetch_assessments_bbox,
    norm_building, norm_land_use, norm_assess
)

# ---------- Config bootstrapping ----------
# Try loading from backend/config.py (Python source config)


# Optional: also support .env or "env" files if you ever add them
try:
    from dotenv import load_dotenv, find_dotenv
    loaded = load_dotenv(find_dotenv(usecwd=True)) or load_dotenv("env")
except Exception:
    pass
# -----------------------------------------

app = Flask(__name__)
CORS(app)
init_db()

def ensure_user(session, username: str):
    u = session.execute(select(User).where(User.username == username)).scalar_one_or_none()
    if not u:
        u = User(username=username)
        session.add(u); session.commit()
    return u

# ---------- Helpers (Shapely 2.x safe enrichment) ----------
def enrich_with_zoning_and_assessment(buildings, landuse, assessments):
    """
    Uses STRtree.query(..., predicate='contains') which returns integer indices on Shapely 2.x.
    Falls back to geometry iteration if predicate query isn't available.
    """
    land_geoms = [shape(f["geometry"]) for f in landuse if f.get("geometry")]
    assess_geoms = [shape(f["geometry"]) for f in assessments if f.get("geometry")]
    land_tree = STRtree(land_geoms) if land_geoms else None
    assess_tree = STRtree(assess_geoms) if assess_geoms else None

    for b in buildings:
        b["zoning"] = "Unknown"
        b["assessed_value"] = None
        if not b.get("geometry"):
            continue
        c = shape(b["geometry"]).centroid

        # --- Land use (zoning)
        if land_tree:
            try:
                idxs = land_tree.query(c, predicate="contains")  # ndarray of indices on Shapely 2.x
                if len(idxs):
                    idx = int(idxs[0])
                    b["zoning"] = landuse[idx]["zoning"]
                else:
                    # Fallback loop (should rarely run)
                    for i, poly in enumerate(land_geoms):
                        if poly.contains(c):
                            b["zoning"] = landuse[i]["zoning"]
                            break
            except Exception:
                # Ultra-safe fallback
                for i, poly in enumerate(land_geoms):
                    try:
                        if poly.contains(c):
                            b["zoning"] = landuse[i]["zoning"]
                            break
                    except Exception:
                        continue

        # --- Assessments (property value)
        if assess_tree:
            try:
                idxs = assess_tree.query(c, predicate="contains")
                if len(idxs):
                    idx = int(idxs[0])
                    b["assessed_value"] = assessments[idx]["assessed_value"]
                else:
                    for i, poly in enumerate(assess_geoms):
                        if poly.contains(c):
                            b["assessed_value"] = assessments[i]["assessed_value"]
                            break
            except Exception:
                for i, poly in enumerate(assess_geoms):
                    try:
                        if poly.contains(c):
                            b["assessed_value"] = assessments[i]["assessed_value"]
                            break
                    except Exception:
                        continue
    return buildings
# -----------------------------------------------------------

@app.get("/api/scene")
def scene():
    bbox = request.args.get("bbox", "-114.0719,51.0455,-114.0630,51.0505")

    # --- Fast mock mode so you can wire frontend immediately ---
    if request.args.get("mock") == "1":
        return jsonify({
            "bbox": bbox,
            "features": [
                {
                    "id": "mock-1",
                    "height_m": 18.0,
                    "levels": 6,
                    "address": "101 Mock St",
                    "zoning": "RC-G",
                    "assessed_value": 420000,
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[
                            [-114.0709, 51.0460],
                            [-114.0704, 51.0460],
                            [-114.0704, 51.0464],
                            [-114.0709, 51.0464],
                            [-114.0709, 51.0460]
                        ]]
                    }
                },
                {
                    "id": "mock-2",
                    "height_m": 35.0,
                    "levels": 12,
                    "address": "102 Mock St",
                    "zoning": "C-COR",
                    "assessed_value": 980000,
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[
                            [-114.0698, 51.0472],
                            [-114.0693, 51.0472],
                            [-114.0693, 51.0476],
                            [-114.0698, 51.0476],
                            [-114.0698, 51.0472]
                        ]]
                    }
                }
            ]
        })

    # --- Real data path (bullet-proofed) ---
    try:
        buildings = [norm_building(f) for f in fetch_buildings_bbox(bbox)]
        landuse   = [norm_land_use(f)   for f in fetch_land_use_bbox(bbox)]
        assessments = [norm_assess(f)   for f in fetch_assessments_bbox(bbox)]

        buildings = enrich_with_zoning_and_assessment(buildings, landuse, assessments)
        return jsonify({"bbox": bbox, "features": buildings})
    except Exception as e:
        # Log for you; never crash the client
        print("SCENE ERROR:", repr(e))
        return jsonify({"bbox": bbox, "features": [], "error": str(e)}), 200

@app.post("/api/llm/filter")
def llm_filter():
    req = LLMQueryRequest(**(request.get_json(force=True) or {}))
    filters, note = parse_filters(req.query)
    return jsonify({"filters": filters, "note": note})

def apply_filters(features, filters):
    def ok(f, spec):
        attr, op, val = spec["attribute"], spec["operator"], spec["value"]
        fv = f.get(attr)
        if attr in ["height_m", "assessed_value", "levels"]:
            try:
                fv = float(fv) if fv is not None else None
                val = float(val)
            except Exception:
                return False
            if fv is None:
                return False
            return (
                (op == ">"  and fv >  val) or
                (op == "<"  and fv <  val) or
                (op == ">=" and fv >= val) or
                (op == "<=" and fv <= val) or
                (op == "="  and abs(fv - val) < 1e-6)
            )
        sv, sval = str(fv or "").lower(), str(val).lower()
        if op == "=":         return sv == sval
        if op == "contains":  return sval in sv
        if op == "in" and isinstance(val, list): return sv in [str(x).lower() for x in val]
        return False
    return [f for f in features if all(ok(f, s) for s in filters)]

@app.post("/api/filter")
def filter_endpoint():
    req = FilterRequest(**(request.get_json(force=True) or {}))
    buildings = [norm_building(f) for f in fetch_buildings_bbox(req.bbox)]
    landuse   = [norm_land_use(f)   for f in fetch_land_use_bbox(req.bbox)]
    assessments = [norm_assess(f)   for f in fetch_assessments_bbox(req.bbox)]

    buildings = enrich_with_zoning_and_assessment(buildings, landuse, assessments)
    matched = apply_filters(buildings, [s.model_dump() if hasattr(s, "model_dump") else s for s in req.filters])

    return jsonify({
        "ids":   [m.get("id") for m in matched if m.get("id") is not None],
        "count": len(matched),
        "filters": req.filters
    })

@app.get("/api/projects")
def list_projects():
    username = request.args.get("username", "demo")
    s = SessionLocal(); u = ensure_user(s, username)
    rows = s.execute(
        select(Project).where(Project.user_id == u.id).order_by(Project.created_at.desc())
    ).scalars().all()
    return jsonify([
        {
            "id": r.id,
            "name": r.name,
            "filters": json.loads(r.filters_json),
            "bbox": r.bbox,
            "created_at": r.created_at.isoformat()
        } for r in rows
    ])

@app.post("/api/projects/save")
def save_project():
    req = SaveProjectRequest(**(request.get_json(force=True) or {}))
    s = SessionLocal(); u = ensure_user(s, req.username)
    p = Project(
        user_id=u.id,
        name=req.name,
        filters_json=json.dumps([f.model_dump() if hasattr(f, "model_dump") else f for f in req.filters]),
        bbox=req.bbox
    )
    s.add(p); s.commit()
    return jsonify({"project_id": p.id})

@app.post("/api/projects/load")
def load_project():
    req = LoadProjectRequest(**(request.get_json(force=True) or {}))
    s = SessionLocal(); row = s.get(Project, req.project_id)
    if not row:
        return jsonify({"error": "not found"}), 404
    return jsonify({
        "id": row.id,
        "name": row.name,
        "filters": json.loads(row.filters_json),
        "bbox": row.bbox
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5001)))
