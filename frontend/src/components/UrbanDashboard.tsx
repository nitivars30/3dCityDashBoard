import { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Building2, 
  Map, 
  BarChart3, 
  Activity,
  MapPin,
  Layers3,
  RefreshCw
} from 'lucide-react';

import CityView3D from './CityView3D';
import ControlPanel from './ControlPanel';
import { BuildingData, BuildingFilter, UserProject, DashboardState } from '@/types/city';
import { fetchCalgaryBuildings, getBuildingStats } from '@/services/calgaryData';
import { processLLMQuery, normalizeFilter } from '@/services/llmService';
import { saveProject, getUserProjects } from '@/services/projectService';

const UrbanDashboard = () => {
  const { toast } = useToast();
  const [state, setState] = useState<DashboardState>({
    buildings: [],
    filteredBuildings: [],
    selectedBuilding: null,
    highlightedBuildings: new Set(),
    activeFilters: [],
    viewport: {
      camera: { position: [100, 150, 200], target: [0, 0, 0] },
      zoom: 1
    },
    loading: true,
    error: null
  });
  
  const [username, setUsername] = useState<string>('');
  const [projects, setProjects] = useState<UserProject[]>([]);
  const [isQueryLoading, setIsQueryLoading] = useState(false);

  // Load initial data
  useEffect(() => {
    loadBuildingData();
    
    // Load saved username from localStorage
    const savedUsername = localStorage.getItem('urban_dashboard_username');
    if (savedUsername) {
      setUsername(savedUsername);
    }
  }, []);

  // Update projects when username changes
  useEffect(() => {
    if (username) {
      localStorage.setItem('urban_dashboard_username', username);
      setProjects(getUserProjects(username));
    } else {
      setProjects([]);
    }
  }, [username]);

  // Calculate filtered buildings when filters change
  const filteredBuildings = useMemo(() => {
    if (state.activeFilters.length === 0) return state.buildings;
    
    return state.buildings.filter(building => {
      return state.activeFilters.every(filter => {
        const value = building[filter.attribute];
        switch (filter.operator) {
          case '>': return Number(value) > Number(filter.value);
          case '<': return Number(value) < Number(filter.value);
          case '>=': return Number(value) >= Number(filter.value);
          case '<=': return Number(value) <= Number(filter.value);
          case '=': return value == filter.value;
          case '!=': return value != filter.value;
          case 'contains': 
            return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
          default: return true;
        }
      });
    });
  }, [state.buildings, state.activeFilters]);

  // Update highlighted buildings when filtered buildings change
  useEffect(() => {
    const highlightedIds = new Set(filteredBuildings.map(b => b.id));
    setState(prev => ({
      ...prev,
      filteredBuildings,
      highlightedBuildings: highlightedIds
    }));
  }, [filteredBuildings]);

  const loadBuildingData = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const buildings = await fetchCalgaryBuildings();
      
      setState(prev => ({
        ...prev,
        buildings,
        filteredBuildings: buildings,
        loading: false
      }));
      
      toast({
        title: "Data Loaded Successfully",
        description: `Loaded ${buildings.length} buildings from Calgary Open Data`,
      });
    } catch (error) {
      console.error('Failed to load building data:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load data'
      }));
      
      toast({
        title: "Error Loading Data",
        description: "Failed to fetch Calgary building data. Using offline mode.",
        variant: "destructive"
      });
    }
  };

  const handleBuildingClick = (building: BuildingData) => {
    setState(prev => ({
      ...prev,
      selectedBuilding: building
    }));
  };

  const handleBuildingHover = (building: BuildingData | null) => {
    // Could add hover effects here
  };

  const handleFilterAdd = (filter: BuildingFilter) => {
    const normalizedFilter = normalizeFilter(filter);
    if (!normalizedFilter) {
      toast({
        title: "Invalid Filter",
        description: "The filter could not be applied",
        variant: "destructive"
      });
      return;
    }

    setState(prev => ({
      ...prev,
      activeFilters: [...prev.activeFilters, normalizedFilter]
    }));
  };

  const handleFilterRemove = (index: number) => {
    setState(prev => ({
      ...prev,
      activeFilters: prev.activeFilters.filter((_, i) => i !== index)
    }));
  };

  const handleFiltersClear = () => {
    setState(prev => ({
      ...prev,
      activeFilters: [],
      selectedBuilding: null
    }));
  };

  const handleLLMQuery = async (query: string): Promise<void> => {
    setIsQueryLoading(true);
    try {
      const filter = await processLLMQuery(query);
      
      if (filter) {
        handleFilterAdd(filter);
        toast({
          title: "Query Processed",
          description: `Applied filter: ${filter.attribute} ${filter.operator} ${filter.value}`,
        });
      } else {
        toast({
          title: "Query Not Understood",
          description: "Please try rephrasing your query or use the example patterns.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('LLM query error:', error);
      toast({
        title: "Query Processing Error",
        description: "Failed to process your query. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsQueryLoading(false);
    }
  };

  const handleProjectSave = (name: string, description?: string) => {
    if (!username) {
      toast({
        title: "Username Required",
        description: "Please enter a username to save projects",
        variant: "destructive"
      });
      return;
    }

    if (state.activeFilters.length === 0) {
      toast({
        title: "No Filters to Save",
        description: "Apply some filters before saving a project",
        variant: "destructive"
      });
      return;
    }

    try {
      const project = saveProject(username, name, state.activeFilters, description);
      setProjects(getUserProjects(username));
      
      toast({
        title: "Project Saved",
        description: `Project "${project.name}" saved successfully`,
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save project. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleProjectLoad = (project: UserProject) => {
    setState(prev => ({
      ...prev,
      activeFilters: [...project.filters],
      selectedBuilding: null
    }));
    
    toast({
      title: "Project Loaded",
      description: `Loaded project "${project.name}" with ${project.filters.length} filters`,
    });
  };

  const buildingStats = getBuildingStats(filteredBuildings);

  if (state.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Loading Calgary City Data</h2>
            <p className="text-muted-foreground">Fetching building footprints and property data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-lg">
                <Building2 className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Urban Design 3D Dashboard</h1>
                <p className="text-sm text-muted-foreground">
                  Interactive Calgary City Data Visualization with AI Querying
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Badge variant="outline" className="flex items-center gap-2">
                <MapPin className="w-3 h-3" />
                Calgary, AB
              </Badge>
              
              <Badge variant="secondary" className="flex items-center gap-2">
                <Activity className="w-3 h-3" />
                {filteredBuildings.length} Buildings
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-180px)]">
          {/* Control Panel */}
          <div className="lg:col-span-1">
            <div className="h-full overflow-y-auto pr-2">
              <ControlPanel
                buildings={state.buildings}
                activeFilters={state.activeFilters}
                selectedBuilding={state.selectedBuilding}
                username={username}
                projects={projects}
                onUsernameChange={setUsername}
                onFilterAdd={handleFilterAdd}
                onFilterRemove={handleFilterRemove}
                onFiltersClear={handleFiltersClear}
                onLLMQuery={handleLLMQuery}
                onProjectSave={handleProjectSave}
                onProjectLoad={handleProjectLoad}
                isLoading={isQueryLoading}
              />
            </div>
          </div>

          {/* Main Visualization Area */}
          <div className="lg:col-span-3">
            <Tabs defaultValue="3d-view" className="h-full flex flex-col">
              <TabsList className="grid grid-cols-3 w-fit">
                <TabsTrigger value="3d-view" className="flex items-center gap-2">
                  <Layers3 className="w-4 h-4" />
                  3D View
                </TabsTrigger>
                <TabsTrigger value="analytics" className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Analytics
                </TabsTrigger>
                <TabsTrigger value="map-view" className="flex items-center gap-2">
                  <Map className="w-4 h-4" />
                  Map View
                </TabsTrigger>
              </TabsList>

              <TabsContent value="3d-view" className="flex-1 mt-4">
                <Card className="h-full">
                  <CardContent className="p-0 h-full">
                    <CityView3D
                      buildings={state.buildings}
                      selectedBuilding={state.selectedBuilding}
                      highlightedBuildings={state.highlightedBuildings}
                      onBuildingClick={handleBuildingClick}
                      onBuildingHover={handleBuildingHover}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="analytics" className="flex-1 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5" />
                        Building Statistics
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center p-3 bg-muted rounded-lg">
                            <div className="text-2xl font-bold text-primary">
                              {buildingStats.totalBuildings}
                            </div>
                            <div className="text-sm text-muted-foreground">Total Buildings</div>
                          </div>
                          <div className="text-center p-3 bg-muted rounded-lg">
                            <div className="text-2xl font-bold text-secondary">
                              {buildingStats.averageHeight.toFixed(1)}m
                            </div>
                            <div className="text-sm text-muted-foreground">Avg Height</div>
                          </div>
                        </div>
                        
                        <Separator />
                        
                        <div>
                          <h4 className="font-medium mb-2">Building Types</h4>
                          <div className="space-y-1">
                            {Object.entries(buildingStats.buildingTypeDistribution).map(([type, count]) => (
                              <div key={type} className="flex justify-between text-sm">
                                <span>{type}</span>
                                <Badge variant="outline">{count}</Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Property Values</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="text-center p-3 bg-muted rounded-lg">
                          <div className="text-xl font-bold text-accent">
                            ${(buildingStats.totalValue / 1000000).toFixed(1)}M
                          </div>
                          <div className="text-sm text-muted-foreground">Total Assessed Value</div>
                        </div>
                        
                        <div className="text-center p-3 bg-muted rounded-lg">
                          <div className="text-xl font-bold">
                            ${buildingStats.averageValue.toLocaleString()}
                          </div>
                          <div className="text-sm text-muted-foreground">Average Value</div>
                        </div>
                        
                        <Separator />
                        
                        <div>
                          <h4 className="font-medium mb-2">Zoning Distribution</h4>
                          <div className="space-y-1">
                            {Object.entries(buildingStats.zoningDistribution).map(([zone, count]) => (
                              <div key={zone} className="flex justify-between text-sm">
                                <span>{zone}</span>
                                <Badge variant="outline">{count}</Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="map-view" className="flex-1 mt-4">
                <Card className="h-full">
                  <CardContent className="p-6 h-full flex items-center justify-center">
                    <div className="text-center space-y-4">
                      <Map className="w-16 h-16 text-muted-foreground mx-auto" />
                      <div>
                        <h3 className="text-lg font-semibold">2D Map View</h3>
                        <p className="text-muted-foreground">
                          Coming soon - Traditional 2D map visualization
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UrbanDashboard;