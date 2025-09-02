import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { 
  MapPin, 
  Search, 
  Save, 
  FolderOpen, 
  Filter, 
  X,
  Building2,
  DollarSign,
  Ruler,
  Calendar
} from 'lucide-react';
import { BuildingFilter, UserProject, BuildingData } from '@/types/city';
import LLMQueryInput from './LLMQueryInput';

interface ControlPanelProps {
  buildings: BuildingData[];
  activeFilters: BuildingFilter[];
  selectedBuilding: BuildingData | null;
  username: string;
  projects: UserProject[];
  onUsernameChange: (username: string) => void;
  onFilterAdd: (filter: BuildingFilter) => void;
  onFilterRemove: (index: number) => void;
  onFiltersClear: () => void;
  onLLMQuery: (query: string) => Promise<void>;
  onProjectSave: (name: string, description?: string) => void;
  onProjectLoad: (project: UserProject) => void;
  isLoading: boolean;
}

const ControlPanel = ({
  buildings,
  activeFilters,
  selectedBuilding,
  username,
  projects,
  onUsernameChange,
  onFilterAdd,
  onFilterRemove,
  onFiltersClear,
  onLLMQuery,
  onProjectSave,
  onProjectLoad,
  isLoading
}: ControlPanelProps) => {
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);

  const handleSaveProject = () => {
    if (projectName.trim()) {
      onProjectSave(projectName.trim(), projectDescription.trim() || undefined);
      setProjectName('');
      setProjectDescription('');
      setShowSaveForm(false);
    }
  };

  const getFilterDisplay = (filter: BuildingFilter) => {
    return `${filter.attribute} ${filter.operator} ${filter.value}`;
  };

  const totalBuildings = buildings.length;
  const filteredCount = buildings.filter(building => {
    return activeFilters.every(filter => {
      const value = building[filter.attribute];
      switch (filter.operator) {
        case '>': return Number(value) > Number(filter.value);
        case '<': return Number(value) < Number(filter.value);
        case '>=': return Number(value) >= Number(filter.value);
        case '<=': return Number(value) <= Number(filter.value);
        case '=': return value == filter.value;
        case '!=': return value != filter.value;
        case 'contains': return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
        default: return true;
      }
    });
  }).length;

  return (
    <div className="space-y-4">
      {/* User Identity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="w-5 h-5" />
            User Identity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => onUsernameChange(e.target.value)}
              placeholder="Enter your username"
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>

      {/* LLM Query */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Search className="w-5 h-5" />
            AI Query Assistant
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LLMQueryInput onQuery={onLLMQuery} isLoading={isLoading} />
        </CardContent>
      </Card>

      {/* Active Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="w-5 h-5" />
            Active Filters
            <Badge variant="outline" className="ml-auto">
              {filteredCount}/{totalBuildings} buildings
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {activeFilters.length === 0 ? (
              <p className="text-sm text-muted-foreground">No filters applied</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {activeFilters.map((filter, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="flex items-center gap-1 pr-1"
                    >
                      {getFilterDisplay(filter)}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => onFilterRemove(index)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onFiltersClear}
                  className="w-full"
                >
                  Clear All Filters
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Building Details */}
      {selectedBuilding && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="w-5 h-5" />
              Building Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Address</Label>
                <p className="font-medium">{selectedBuilding.address}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Ruler className="w-3 h-3" />
                    Height
                  </Label>
                  <p className="font-medium">{selectedBuilding.height.toFixed(1)}m</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    Value
                  </Label>
                  <p className="font-medium">
                    ${selectedBuilding.assessedValue.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Zoning</Label>
                  <p className="font-medium">{selectedBuilding.zoning}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Built
                  </Label>
                  <p className="font-medium">{selectedBuilding.yearBuilt}</p>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Type</Label>
                <p className="font-medium">{selectedBuilding.buildingType}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Project Management */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FolderOpen className="w-5 h-5" />
            Project Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {!showSaveForm ? (
              <Button
                onClick={() => setShowSaveForm(true)}
                disabled={!username || activeFilters.length === 0}
                className="w-full"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Current Filters
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="project-name">Project Name</Label>
                  <Input
                    id="project-name"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Enter project name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project-description">Description (Optional)</Label>
                  <Textarea
                    id="project-description"
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    placeholder="Brief description..."
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveProject} className="flex-1">
                    Save
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowSaveForm(false);
                      setProjectName('');
                      setProjectDescription('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {projects.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Saved Projects</Label>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {projects.map((project) => (
                      <div
                        key={project.id}
                        className="flex items-center justify-between p-2 rounded border hover:bg-muted cursor-pointer"
                        onClick={() => onProjectLoad(project)}
                      >
                        <div>
                          <p className="text-sm font-medium">{project.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {project.filters.length} filters
                          </p>
                        </div>
                        <Button size="sm" variant="ghost">
                          Load
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ControlPanel;