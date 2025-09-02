// Types for Calgary City Data and 3D Visualization

export interface BuildingData {
  id: string;
  address: string;
  latitude: number;
  longitude: number;
  height: number;
  footprint: GeoJSONPolygon;
  assessedValue: number;
  zoning: string;
  buildingType: string;
  yearBuilt: number;
  floors: number;
  area: number;
}

export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface BuildingFilter {
  attribute: keyof BuildingData;
  operator: '>' | '<' | '=' | '>=' | '<=' | '!=' | 'contains';
  value: string | number;
}

export interface LLMQuery {
  query: string;
  filter: BuildingFilter | null;
  timestamp: Date;
}

export interface UserProject {
  id: string;
  name: string;
  username: string;
  filters: BuildingFilter[];
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BuildingMesh {
  id: string;
  position: [number, number, number];
  scale: [number, number, number];
  data: BuildingData;
  isSelected: boolean;
  isHighlighted: boolean;
}

export interface ViewportState {
  camera: {
    position: [number, number, number];
    target: [number, number, number];
  };
  zoom: number;
}

export interface DashboardState {
  buildings: BuildingData[];
  filteredBuildings: BuildingData[];
  selectedBuilding: BuildingData | null;
  highlightedBuildings: Set<string>;
  activeFilters: BuildingFilter[];
  viewport: ViewportState;
  loading: boolean;
  error: string | null;
}