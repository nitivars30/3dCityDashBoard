# backend/services/llm.py
import os, re, json
from typing import List, Tuple, Dict, Any

SYSTEM_PROMPT = """You extract structured filters from a natural-language query about buildings.
Always return ONLY a compact JSON object with a 'filters' array, no prose.

Allowed attributes: height_m, levels, zoning, assessed_value, address, use
Allowed operators: >, <, >=, <=, =, contains, in

Examples:
Input: highlight buildings over 100 feet
Output: {"filters":[{"attribute":"height_m","operator":">","value":30.48}]}

Input: show buildings less than $500,000 in value
Output: {"filters":[{"attribute":"assessed_value","operator":"<","value":500000}]}

Input: show buildings in RC-G zoning
Output: {"filters":[{"attribute":"zoning","operator":"=","value":"RC-G"}]}
"""

# ---------- FALLBACK PARSER (always available) ----------
def _fallback_rule_based(q: str) -> List[Dict[str, Any]]:
    ql = q.lower()

    # Only treat numbers as MONEY if the query clearly hints at value/price
    money_hint = ("$" in q) or any(
        w in ql for w in [
            "dollar", "dollars", "value", "assess", "assessed", "assessment",
            "valuation", "price", "worth", "cost"
        ]
    )

    # Extractors
    m_feet   = re.search(r"(\d+(?:\.\d+)?)\s*(?:ft|feet)\b", ql)
    m_meters = re.search(r"(\d+(?:\.\d+)?)\s*(?:m|meter|meters)\b", ql)
    m_levels = re.search(r"(\d+)\s*(?:levels?|storeys?|stories?)\b", ql)
    m_zone   = re.search(r"\b([A-Z]{1,3}-[A-Z]{1,3})\b", q)  # e.g., RC-G, C-COR
    m_money  = re.search(r"\$?\s*([\d,]+(?:\.\d+)?)\b", ql) if money_hint else None

    # Operator heuristics (applies to whichever attribute we found)
    op = ">"
    if any(w in ql for w in ["less than", "under", "below", "<"]): op = "<"
    if "at least" in ql or ">=" in ql: op = ">="
    if "at most"  in ql or "<=" in ql: op = "<="
    if " equal" in ql or "exact" in ql or " = " in ql: op = "="

    filters: List[Dict[str, Any]] = []

    # Height
    if m_feet:
        val_m = float(m_feet.group(1)) * 0.3048
        filters.append({"attribute": "height_m", "operator": op, "value": round(val_m, 2)})
    elif m_meters:
        filters.append({"attribute": "height_m", "operator": op, "value": float(m_meters.group(1))})

    # Levels
    if m_levels:
        filters.append({"attribute": "levels", "operator": op, "value": float(m_levels.group(1))})

    # Zoning
    if m_zone:
        filters.append({"attribute": "zoning", "operator": "=", "value": m_zone.group(1)})

    # Assessed value — only when clearly hinted
    if m_money:
        try:
            val = float(m_money.group(1).replace(",", ""))
            filters.append({"attribute": "assessed_value", "operator": op, "value": val})
        except Exception:
            pass

    # Use keywords
    if "commercial" in ql:
        filters.append({"attribute": "use", "operator": "=", "value": "commercial"})
    if "residential" in ql:
        filters.append({"attribute": "use", "operator": "=", "value": "residential"})

    return filters


# ---------- MAIN ENTRY ----------
def parse_filters(query: str) -> Tuple[List[Dict[str, Any]], str]:
    """
    Returns (filters, note). Tries HF Inference API; on any failure, uses fallback.
    Reads env AT CALL TIME so config changes don't require import-order hacks.
    """
    token = os.environ.get("HF_API_KEY", "") or ""
    primary = os.environ.get("HF_MODEL", "Qwen/Qwen2.5-7B-Instruct")
    candidates = [
        primary,  # your configured model first
        "HuggingFaceH4/zephyr-7b-beta",
        "mistralai/Mistral-7B-Instruct-v0.3",
    ]

    # No token → immediate fallback
    if not token:
        return _fallback_rule_based(query) or [], "fallback"

    # Import client lazily so missing package falls back cleanly
    try:
        from huggingface_hub import InferenceClient
    except ModuleNotFoundError:
        return _fallback_rule_based(query) or [], "fallback_error:missing_huggingface_hub"

    prompt = f"{SYSTEM_PROMPT}\nInput: {query}\nOutput:"
    last_err: Any = None

    for model in candidates:
        try:
            client = InferenceClient(model=model, token=token)
            resp = client.text_generation(
                prompt,
                max_new_tokens=200,
                temperature=0.1,
                top_p=0.9,
                repetition_penalty=1.05,
            )
            # resp is a string; extract first {...}
            m = re.search(r"\{.*\}", resp, flags=re.S)
            if not m:
                last_err = "no_json"
                continue
            obj = json.loads(m.group(0))
            fs = obj.get("filters") or []
            # normalize numeric values
            for f in fs:
                if f.get("attribute") in ("height_m","levels","assessed_value"):
                    try:
                        f["value"] = float(f["value"])
                    except Exception:
                        pass
            return fs, f"hf:{model}"
        except Exception as e:
            last_err = type(e).__name__
            continue

    # If every model failed, return fallback with an error note
    return _fallback_rule_based(query) or [], f"fallback_error:{last_err}"
