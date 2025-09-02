// src/App.tsx
import { useEffect, useRef, useState } from "react";
import createScene from "./three/createScene";
import { fetchScene, parseLLM, applyFilter, saveProject, listProjects, loadProject } from "./lib/api";

type Feature = {
  id?: string | number;
  geometry: { type: string; coordinates: any };
  height_m?: number;
  levels?: number;
  address?: string;
  zoning?: string;
  assessed_value?: number | null;
  raw?: any;
};

const DEFAULT_BBOX = "-114.0719,51.0455,-114.0630,51.0505";

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ReturnType<typeof createScene> | null>(null);

  const [bbox, setBbox] = useState(DEFAULT_BBOX);
  const [mock, setMock] = useState(false);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<any[]>([]);
  const [picked, setPicked] = useState<Feature | null>(null);
  const [username, setUsername] = useState<string>(() => localStorage.getItem("username") || "");
  const [projectName, setProjectName] = useState("");
  const [projects, setProjects] = useState<any[]>([]);

  // loading flags for UI feedback
  const [loadingScene, setLoadingScene] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => { localStorage.setItem("username", username); }, [username]);

  // Init scene
  useEffect(() => {
    if (!mountRef.current) return;
    sceneRef.current = createScene(mountRef.current, { onPick: setPicked });
    return () => sceneRef.current?.dispose();
  }, []);

  // Load scene data
  async function load(b = bbox, useMock = mock) {
    try {
      setLoadingScene(true);
      const data = await fetchScene(b, useMock);
      const feats = (data?.features || []).map((f: any, i: number) => ({
        ...f,
        id: f?.id != null ? String(f.id) : String(i),
      })) as Feature[];
      
      setFeatures(feats);
      sceneRef.current?.loadFeatures(feats);
      setPicked(null);
    } finally {
      setLoadingScene(false);
    }
  }
  useEffect(() => { load(bbox, mock); /* on mount */ }, []);

  // Parse + Apply in one click with feedback
  async function handleParseAndApply() {
    try {
      setParsing(true);
      const { filters: fs } = await parseLLM(query);
      setFilters(fs || []);
    } finally {
      setParsing(false);
    }
    try {
      setApplying(true);
      const { ids } = await applyFilter(bbox, (filters.length ? filters : await parseLLM(query)).filters || []);
      sceneRef.current?.highlightByIds(ids || []);
    } finally {
      setApplying(false);
    }
  }

  // Clear highlights + filters
  function handleClear() {
    setFilters([]);
    sceneRef.current?.highlightByIds([]); // reset colors to default
    setPicked(null);
  }

  // Reload button (refetch + clear highlights)
  async function handleReload() {
    await load(bbox, mock);
    sceneRef.current?.highlightByIds([]); // clear any old highlights
    setPicked(null);
  }

  // Save / List / Load
  async function handleSave() {
    if (!username.trim()) return alert("Enter a username first.");
    if (!projectName.trim()) return alert("Give your project a name.");
    await saveProject(username.trim(), projectName.trim(), filters, bbox);
    const rows = await listProjects(username.trim());
    setProjects(rows);
  }
  async function refreshProjects() {
    if (!username.trim()) return alert("Enter a username first.");
    const rows = await listProjects(username.trim());
    setProjects(rows);
  }
  async function handleLoad(id: number) {
    if (!username.trim()) return alert("Enter a username first.");
    const p = await loadProject(username.trim(), id);
    setFilters(p.filters || []);
    const b = p.bbox || DEFAULT_BBOX;
    setBbox(b);
    await load(b, mock);
    const r = await applyFilter(b, p.filters || []);
    sceneRef.current?.highlightByIds(r.ids || []);
  }

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 relative" ref={mountRef}>
        {loadingScene && (
          <div className="absolute top-2 left-2 bg-white/90 border rounded px-2 py-1 text-xs">
            Loading buildings…
          </div>
        )}
        {(parsing || applying) && (
          <div className="absolute top-2 right-2 bg-white/90 border rounded px-2 py-1 text-xs">
            {parsing ? "Parsing query…" : applying ? "Applying filters…" : ""}
          </div>
        )}
      </div>

      <div className="w-[380px] p-4 border-l bg-white overflow-auto">
        <h1 className="text-xl font-semibold mb-3">Calgary 3D City Dashboard</h1>

        <label className="text-xs text-gray-600">BBox</label>
        <div className="flex gap-2 mb-2">
          <input
            className="flex-1 border px-2 py-1 text-sm"
            value={bbox}
            onChange={(e) => setBbox(e.target.value)}
          />
          <button className="border px-3 py-1 text-sm" onClick={handleReload} disabled={loadingScene}>
            {loadingScene ? "Reloading…" : "Reload"}
          </button>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <input
            id="mock"
            type="checkbox"
            checked={mock}
            onChange={(e) => { setMock(e.target.checked); load(bbox, e.target.checked); }}
          />
          <label htmlFor="mock" className="text-sm">Mock data (2 demo buildings)</label>
        </div>

        <label className="text-xs text-gray-600">Query</label>
        <div className="flex gap-2 mb-2">
          <input
            className="flex-1 border px-2 py-1 text-sm"
            placeholder='e.g., "over 100 feet"'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2 mb-3">
          <button
            className="border px-3 py-1 text-sm"
            onClick={handleParseAndApply}
            disabled={parsing || applying}
          >
            {parsing ? "Parsing…" : applying ? "Applying…" : "Parse + Apply"}
          </button>
          <button className="border px-3 py-1 text-sm" onClick={handleClear}>
            Clear
          </button>
        </div>

        <div className="mb-4">
          <div className="text-xs text-gray-600 mb-1">Filters</div>
          <pre className="text-[11px] bg-gray-50 border p-2 rounded max-h-32 overflow-auto">
            {JSON.stringify(filters, null, 2)}
          </pre>
        </div>

        <div className="mb-4">
          <div className="text-xs text-gray-600 mb-1">Picked Building</div>
          <div className="text-sm leading-5 bg-gray-50 border p-2 rounded">
            {picked ? (
              <>
                <div><b>Address:</b> {picked.address || "—"}</div>
                <div><b>Zoning:</b> {picked.zoning || "—"}</div>
                <div><b>Height (m):</b> {picked.height_m ?? "—"}</div>
                <div><b>Assessed:</b> {picked.assessed_value?.toLocaleString?.() ?? "—"}</div>
                <div className="text-[11px] text-gray-500 break-words mt-1"><b>ID:</b> {String(picked.id ?? "—")}</div>
              </>
            ) : (
              <div className="text-gray-500">Click a building</div>
            )}
          </div>
        </div>

        <div className="mb-2">
          <label className="text-xs text-gray-600">Username</label>
          <input
            className="w-full border px-2 py-1 text-sm"
            placeholder="your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="mb-2">
          <label className="text-xs text-gray-600">Project name</label>
          <input
            className="w-full border px-2 py-1 text-sm"
            placeholder="project name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />
        </div>
        <div className="flex gap-2 mb-3">
          <button className="border px-3 py-1 text-sm" onClick={handleSave}>
            Save Project
          </button>
          <button className="border px-3 py-1 text-sm" onClick={refreshProjects}>
            List
          </button>
        </div>

        <div className="space-y-1">
          {projects.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between border rounded px-2 py-1 text-sm">
              <div className="truncate">{p.name}</div>
              <button className="border px-2 py-0.5 text-xs" onClick={() => handleLoad(p.id)}>
                Load
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
