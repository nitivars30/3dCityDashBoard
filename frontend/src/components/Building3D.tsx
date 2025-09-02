import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh } from 'three';
import { BuildingMesh } from '@/types/city';

interface Building3DProps {
  mesh: BuildingMesh;
  onClick: () => void;
  onHover: (hovered: boolean) => void;
}

const Building3D = ({ mesh, onClick, onHover }: Building3DProps) => {
  const ref = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);

  // Smooth animations
  useFrame((state, delta) => {
    if (ref.current) {
      const targetScale = hovered ? 1.05 : 1;
      const currentScale = ref.current.scale.x;
      const newScale = currentScale + (targetScale - currentScale) * delta * 8;
      ref.current.scale.setScalar(newScale);
      
      // Subtle floating animation for selected buildings
      if (mesh.isSelected) {
        ref.current.position.y = mesh.position[1] + Math.sin(state.clock.elapsedTime * 2) * 0.5;
      }
    }
  });

  const getColor = () => {
    if (mesh.isSelected) return 'hsl(var(--building-selected))';
    if (mesh.isHighlighted) return 'hsl(var(--building-highlighted))';
    return 'hsl(var(--building-default))';
  };

  const getEmissive = () => {
    if (mesh.isSelected) return 'hsl(var(--primary-glow))';
    if (mesh.isHighlighted) return 'hsl(var(--accent))';
    return '#000000';
  };

  return (
    <mesh
      ref={ref}
      position={mesh.position}
      scale={mesh.scale}
      onClick={onClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        onHover(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        onHover(false);
        document.body.style.cursor = 'default';
      }}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshPhongMaterial
        color={getColor()}
        emissive={getEmissive()}
        emissiveIntensity={mesh.isSelected ? 0.3 : mesh.isHighlighted ? 0.2 : 0}
        shininess={100}
      />
    </mesh>
  );
};

export default Building3D;