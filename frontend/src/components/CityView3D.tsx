import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, Grid } from '@react-three/drei';
import { Suspense, useMemo } from 'react';
import { BuildingMesh, BuildingData } from '@/types/city';
import Building3D from './Building3D';
import LoadingSpinner from './LoadingSpinner';

interface CityView3DProps {
  buildings: BuildingData[];
  selectedBuilding: BuildingData | null;
  highlightedBuildings: Set<string>;
  onBuildingClick: (building: BuildingData) => void;
  onBuildingHover: (building: BuildingData | null) => void;
}

const CityView3D = ({
  buildings,
  selectedBuilding,
  highlightedBuildings,
  onBuildingClick,
  onBuildingHover
}: CityView3DProps) => {
  // Convert building data to 3D mesh data
  const buildingMeshes = useMemo(() => {
    if (!buildings.length) return [];

    // Find the center point of all buildings
    const centerLat = buildings.reduce((sum, b) => sum + b.latitude, 0) / buildings.length;
    const centerLng = buildings.reduce((sum, b) => sum + b.longitude, 0) / buildings.length;

    return buildings.map((building): BuildingMesh => {
      // Convert lat/lng to local coordinates (simplified projection)
      const x = (building.longitude - centerLng) * 111000; // Rough meters per degree
      const z = -(building.latitude - centerLat) * 111000; // Negative Z for correct orientation
      const y = building.height / 2; // Half height for center positioning

      // Calculate building scale from footprint
      const coords = building.footprint.coordinates[0];
      const minX = Math.min(...coords.map(c => c[0]));
      const maxX = Math.max(...coords.map(c => c[0]));
      const minY = Math.min(...coords.map(c => c[1]));
      const maxY = Math.max(...coords.map(c => c[1]));
      
      const width = (maxX - minX) * 111000; // Convert to meters
      const depth = (maxY - minY) * 111000;

      return {
        id: building.id,
        position: [x, y, z],
        scale: [width, building.height, depth],
        data: building,
        isSelected: selectedBuilding?.id === building.id,
        isHighlighted: highlightedBuildings.has(building.id)
      };
    });
  }, [buildings, selectedBuilding, highlightedBuildings]);

  return (
    <div className="w-full h-full canvas-container">
      <Canvas shadows>
        <Suspense fallback={<LoadingSpinner />}>
          {/* Camera */}
          <PerspectiveCamera
            makeDefault
            position={[100, 150, 200]}
            fov={60}
            near={0.1}
            far={2000}
          />

          {/* Controls */}
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            maxPolarAngle={Math.PI / 2.2}
            minDistance={50}
            maxDistance={500}
            target={[0, 0, 0]}
          />

          {/* Lighting */}
          <ambientLight intensity={0.4} />
          <directionalLight
            position={[100, 200, 100]}
            intensity={0.8}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-far={500}
            shadow-camera-left={-200}
            shadow-camera-right={200}
            shadow-camera-top={200}
            shadow-camera-bottom={-200}
          />

          {/* Environment */}
          <Environment preset="city" background={false} />
          
          {/* Ground Grid */}
          <Grid
            args={[1000, 1000]}
            position={[0, -1, 0]}
            cellSize={20}
            cellThickness={0.5}
            cellColor="#6B7280"
            sectionSize={100}
            sectionThickness={1}
            sectionColor="#374151"
            fadeDistance={400}
            fadeStrength={1}
            followCamera={false}
            infiniteGrid={true}
          />

          {/* Ground Plane */}
          <mesh 
            position={[0, -1, 0]} 
            rotation={[-Math.PI / 2, 0, 0]} 
            receiveShadow
          >
            <planeGeometry args={[1000, 1000]} />
            <meshLambertMaterial color="hsl(var(--ground))" />
          </mesh>

          {/* Buildings */}
          {buildingMeshes.map((mesh) => (
            <Building3D
              key={mesh.id}
              mesh={mesh}
              onClick={() => onBuildingClick(mesh.data)}
              onHover={(hovered) => onBuildingHover(hovered ? mesh.data : null)}
            />
          ))}
        </Suspense>
      </Canvas>
    </div>
  );
};

export default CityView3D;