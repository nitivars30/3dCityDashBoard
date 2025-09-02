import { BuildingData } from '@/types/city';

// Calgary Open Data API service
// Note: Using mock data for development - replace with actual API calls

const CALGARY_API_BASE = 'https://data.calgary.ca/resource';

// Mock Calgary building data for demonstration
const generateMockBuildingData = (): BuildingData[] => {
  const buildings: BuildingData[] = [];
  const baseLatitude = 51.0447;  // Calgary downtown area
  const baseLongitude = -114.0719;
  
  // Generate buildings in a 4x4 block grid
  for (let i = 0; i < 50; i++) {
    const offsetLat = (Math.random() - 0.5) * 0.01; // ~500m radius
    const offsetLng = (Math.random() - 0.5) * 0.01;
    
    const latitude = baseLatitude + offsetLat;
    const longitude = baseLongitude + offsetLng;
    
    // Generate building footprint (rectangle)
    const width = 0.0001 + Math.random() * 0.0002; // Building width in degrees
    const depth = 0.0001 + Math.random() * 0.0002; // Building depth in degrees
    
    const footprint = {
      type: 'Polygon' as const,
      coordinates: [[
        [longitude - width/2, latitude - depth/2],
        [longitude + width/2, latitude - depth/2],
        [longitude + width/2, latitude + depth/2],
        [longitude - width/2, latitude + depth/2],
        [longitude - width/2, latitude - depth/2]
      ]]
    };

    const height = 10 + Math.random() * 200; // 10-210 meters
    const floors = Math.ceil(height / 3.5); // ~3.5m per floor
    const area = width * depth * 111000 * 111000; // Approximate square meters
    
    const buildingTypes = ['Residential', 'Commercial', 'Office', 'Mixed Use', 'Industrial'];
    const zoningTypes = ['RC-1', 'RC-2', 'RC-G', 'CC', 'M-I', 'R-C2'];
    
    const building: BuildingData = {
      id: `building_${i + 1}`,
      address: `${Math.floor(Math.random() * 9999) + 1} ${['Main St', 'Centre St', '1st Ave', '2nd Ave', '3rd Ave', '4th Ave'][Math.floor(Math.random() * 6)]} SW`,
      latitude,
      longitude,
      height: Math.round(height * 10) / 10,
      footprint,
      assessedValue: Math.floor(200000 + Math.random() * 2000000),
      zoning: zoningTypes[Math.floor(Math.random() * zoningTypes.length)],
      buildingType: buildingTypes[Math.floor(Math.random() * buildingTypes.length)],
      yearBuilt: 1950 + Math.floor(Math.random() * 74), // 1950-2024
      floors,
      area: Math.round(area)
    };
    
    buildings.push(building);
  }
  
  return buildings;
};

export const fetchCalgaryBuildings = async (): Promise<BuildingData[]> => {
  // In a real implementation, this would fetch from Calgary's Open Data API
  // Example endpoints:
  // - Building Footprints: https://data.calgary.ca/resource/building-footprints.json
  // - Property Assessments: https://data.calgary.ca/resource/property-assessments.json
  // - Zoning Districts: https://data.calgary.ca/resource/zoning-districts.json
  
  try {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Return mock data for development
    const buildings = generateMockBuildingData();
    console.log(`Fetched ${buildings.length} buildings from Calgary Open Data`);
    
    return buildings;
  } catch (error) {
    console.error('Error fetching Calgary building data:', error);
    throw new Error('Failed to fetch building data from Calgary Open Data API');
  }
};

export const searchBuildings = (
  buildings: BuildingData[],
  searchTerm: string
): BuildingData[] => {
  if (!searchTerm.trim()) return buildings;
  
  const term = searchTerm.toLowerCase();
  return buildings.filter(building =>
    building.address.toLowerCase().includes(term) ||
    building.buildingType.toLowerCase().includes(term) ||
    building.zoning.toLowerCase().includes(term)
  );
};

// Helper function to calculate building density in an area
export const calculateBuildingDensity = (buildings: BuildingData[]): number => {
  if (buildings.length === 0) return 0;
  
  const totalArea = buildings.reduce((sum, building) => sum + building.area, 0);
  return buildings.length / (totalArea / 10000); // Buildings per hectare
};

// Helper function to get building statistics
export const getBuildingStats = (buildings: BuildingData[]) => {
  if (buildings.length === 0) {
    return {
      totalBuildings: 0,
      averageHeight: 0,
      averageValue: 0,
      totalValue: 0,
      buildingTypeDistribution: {},
      zoningDistribution: {}
    };
  }
  
  const totalValue = buildings.reduce((sum, b) => sum + b.assessedValue, 0);
  const averageHeight = buildings.reduce((sum, b) => sum + b.height, 0) / buildings.length;
  const averageValue = totalValue / buildings.length;
  
  const buildingTypeDistribution = buildings.reduce((acc, b) => {
    acc[b.buildingType] = (acc[b.buildingType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const zoningDistribution = buildings.reduce((acc, b) => {
    acc[b.zoning] = (acc[b.zoning] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return {
    totalBuildings: buildings.length,
    averageHeight: Math.round(averageHeight * 10) / 10,
    averageValue: Math.round(averageValue),
    totalValue,
    buildingTypeDistribution,
    zoningDistribution
  };
};