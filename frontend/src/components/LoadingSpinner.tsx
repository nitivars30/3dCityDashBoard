import { Html } from '@react-three/drei';

const LoadingSpinner = () => {
  return (
    <Html center>
      <div className="flex items-center space-x-2 text-primary">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="text-sm font-medium">Loading 3D City Data...</span>
      </div>
    </Html>
  );
};

export default LoadingSpinner;