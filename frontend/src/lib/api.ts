// src/lib/api.ts
import axios from "axios";
export const API_BASE = (import.meta as any).env?.VITE_API_BASE || "http://localhost:5001";

export const fetchScene = (bbox: string, mock = false) =>
  axios.get(`${API_BASE}/api/scene`, { params: { bbox, mock: mock ? "1" : undefined } })
       .then(r => r.data);

export const parseLLM = (query: string) =>
  axios.post(`${API_BASE}/api/llm/filter`, { query }).then(r => r.data);

export const applyFilter = (bbox: string, filters: any[]) =>
  axios.post(`${API_BASE}/api/filter`, { bbox, filters }).then(r => r.data);

export const saveProject = (username: string, name: string, filters: any[], bbox: string) =>
  axios.post(`${API_BASE}/api/projects/save`, { username, name, filters, bbox }).then(r => r.data);

export const listProjects = (username: string) =>
  axios.get(`${API_BASE}/api/projects`, { params: { username } }).then(r => r.data);

export const loadProject = (username: string, project_id: number) =>
  axios.post(`${API_BASE}/api/projects/load`, { username, project_id }).then(r => r.data);
