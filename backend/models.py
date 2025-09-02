from pydantic import BaseModel
from typing import Any, List, Literal, Optional

class FilterSpec(BaseModel):
    attribute: Literal["height_m","levels","zoning","assessed_value","use","address"]
    operator: Literal[">","<",">=","<=","=","contains","in"]
    value: Any

class SaveProjectRequest(BaseModel):
    username: str
    name: str
    filters: List[FilterSpec]
    bbox: Optional[str] = None

class LoadProjectRequest(BaseModel):
    username: str
    project_id: int

class LLMQueryRequest(BaseModel):
    query: str

class FilterRequest(BaseModel):
    bbox: str
    filters: List[FilterSpec]

