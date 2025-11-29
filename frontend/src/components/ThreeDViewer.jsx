import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, OrthographicCamera } from '@react-three/drei';
import { Suspense } from 'react';

const ApartmentModel = ({ viewMode }) => {
  // Simple primitive representation of an apartment
  // In production, this would load a GLB/GLTF file
  
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#f0f0f0" />
      </mesh>

      {/* Room 1 - Living Room */}
      <mesh position={[-5, 0.5, -5]}>
        <boxGeometry args={[6, 1, 6]} />
        <meshStandardMaterial color="#e3f2fd" />
      </mesh>

      {/* Room 2 - Bedroom */}
      <mesh position={[5, 0.5, -5]}>
        <boxGeometry args={[6, 1, 6]} />
        <meshStandardMaterial color="#f3e5f5" />
      </mesh>

      {/* Room 3 - Kitchen */}
      <mesh position={[-5, 0.5, 5]}>
        <boxGeometry args={[6, 1, 6]} />
        <meshStandardMaterial color="#fff3e0" />
      </mesh>

      {/* Room 4 - Bathroom */}
      <mesh position={[5, 0.5, 5]}>
        <boxGeometry args={[6, 1, 6]} />
        <meshStandardMaterial color="#e0f2f1" />
      </mesh>

      {/* Walls */}
      <mesh position={[0, 1, -10]}>
        <boxGeometry args={[20, 2, 0.2]} />
        <meshStandardMaterial color="#bdbdbd" />
      </mesh>
      <mesh position={[0, 1, 10]}>
        <boxGeometry args={[20, 2, 0.2]} />
        <meshStandardMaterial color="#bdbdbd" />
      </mesh>
      <mesh position={[-10, 1, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[20, 2, 0.2]} />
        <meshStandardMaterial color="#bdbdbd" />
      </mesh>
      <mesh position={[10, 1, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[20, 2, 0.2]} />
        <meshStandardMaterial color="#bdbdbd" />
      </mesh>
    </>
  );
};

export const ThreeDViewer = ({ variant, viewMode = '3d' }) => {
  return (
    <Canvas>
      <Suspense fallback={null}>
        {viewMode === 'top' ? (
          <OrthographicCamera makeDefault position={[0, 20, 0]} zoom={50} />
        ) : viewMode === 'first-person' ? (
          <PerspectiveCamera makeDefault position={[0, 1.6, 0]} fov={75} />
        ) : (
          <PerspectiveCamera makeDefault position={[15, 10, 15]} fov={50} />
        )}
        <ApartmentModel viewMode={viewMode} />
        {viewMode !== 'first-person' && <OrbitControls />}
      </Suspense>
    </Canvas>
  );
};


