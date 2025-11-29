import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export const ThreeDViewer = ({ variant, viewMode = '3d' }) => {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);

  // Debug: log variant structure
  useEffect(() => {
    if (variant) {
      const blueprintUrl = variant?.aiRequest?.plan?.fileUrl || variant?.thumbnailUrl;
      console.log('ThreeDViewer - Variant data:', {
        hasVariant: !!variant,
        hasAiRequest: !!variant.aiRequest,
        hasPlan: !!variant.aiRequest?.plan,
        planFileUrl: variant.aiRequest?.plan?.fileUrl,
        thumbnailUrl: variant.thumbnailUrl,
        blueprintUrl: blueprintUrl,
        variantId: variant.id,
      });
      
      if (!blueprintUrl) {
        console.error('No blueprint URL found! Variant structure:', JSON.stringify(variant, null, 2));
      }
    }
  }, [variant]);

  // Helper function to convert S3 URL to proxy URL
  const getProxyImageUrl = (imageUrl) => {
    if (!imageUrl) return null;
    
    // If it's already a local URL or proxy URL, return as-is
    if (imageUrl.startsWith('http://localhost') || imageUrl.startsWith('/')) {
      return imageUrl;
    }
    
    // If it's an S3 URL, use proxy endpoint
    if (imageUrl.includes('storage.yandexcloud.net') || imageUrl.includes('yandexcloud.net')) {
      const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
      return `${backendUrl}/plans/proxy?url=${encodeURIComponent(imageUrl)}`;
    }
    
    // Return as-is for other URLs
    return imageUrl;
  };

  useEffect(() => {
    // Get blueprint URL from variant - try multiple paths
    const originalUrl = variant?.aiRequest?.plan?.fileUrl || variant?.thumbnailUrl || null;
    const blueprintUrl = getProxyImageUrl(originalUrl);
    
    console.log('ThreeDViewer useEffect - Original URL:', originalUrl);
    console.log('ThreeDViewer useEffect - Proxy URL:', blueprintUrl);
    console.log('Container ref:', !!containerRef.current);
    
    if (!containerRef.current || !blueprintUrl) {
      console.warn('Cannot initialize viewer - missing container or blueprint URL');
      setIsLoading(false);
      return;
    }

    // Cleanup previous renderer if exists
    if (rendererRef.current && containerRef.current.contains(rendererRef.current.domElement)) {
      containerRef.current.removeChild(rendererRef.current.domElement);
      rendererRef.current.dispose();
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Initialize scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    sceneRef.current = scene;

    // Initialize camera based on view mode
    let camera;
    if (viewMode === 'top') {
      camera = new THREE.OrthographicCamera(
        -10, 10, 10, -10, 0.1, 1000
      );
      camera.position.set(0, 20, 0);
      camera.lookAt(0, 0, 0);
    } else if (viewMode === 'first-person') {
      camera = new THREE.PerspectiveCamera(75, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 1000);
      camera.position.set(0, 1.6, 0);
    } else {
      camera = new THREE.PerspectiveCamera(75, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 1000);
      camera.position.set(15, 10, 15);
      camera.lookAt(0, 0, 0);
    }
    cameraRef.current = camera;

    // Initialize renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 15);
    scene.add(directionalLight);

    // Load blueprint image and create house
    createHouseFromPlan(blueprintUrl, scene);

    // Mouse controls for orbital rotation (only for 3d view)
    if (viewMode === '3d') {
      let mouseDown = false;
      let lastMouseX = 0;
      let lastMouseY = 0;
      
      const spherical = {
        radius: Math.sqrt(camera.position.x ** 2 + camera.position.y ** 2 + camera.position.z ** 2),
        theta: Math.atan2(camera.position.x, camera.position.z),
        phi: Math.acos(camera.position.y / Math.sqrt(camera.position.x ** 2 + camera.position.y ** 2 + camera.position.z ** 2))
      };
      
      const center = new THREE.Vector3(0, 0, 0);

      const onMouseDown = (e) => {
        mouseDown = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
      };

      const onMouseMove = (e) => {
        if (!mouseDown) return;
        
        const deltaX = e.clientX - lastMouseX;
        const deltaY = e.clientY - lastMouseY;
        
        spherical.theta -= deltaX * 0.01;
        spherical.phi += deltaY * 0.01;
        spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
        
        camera.position.x = center.x + spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
        camera.position.y = center.y + spherical.radius * Math.cos(spherical.phi);
        camera.position.z = center.z + spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
        
        camera.lookAt(center);
        
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
      };

      const onMouseUp = () => {
        mouseDown = false;
      };

      const onWheel = (e) => {
        e.preventDefault();
        spherical.radius += e.deltaY * 0.01;
        spherical.radius = Math.max(5, Math.min(100, spherical.radius));
        
        camera.position.x = center.x + spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
        camera.position.y = center.y + spherical.radius * Math.cos(spherical.phi);
        camera.position.z = center.z + spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
        
        camera.lookAt(center);
      };

      renderer.domElement.addEventListener('mousedown', onMouseDown);
      renderer.domElement.addEventListener('mousemove', onMouseMove);
      renderer.domElement.addEventListener('mouseup', onMouseUp);
      renderer.domElement.addEventListener('wheel', onWheel);

      // Store cleanup function
      const cleanupControls = () => {
        renderer.domElement.removeEventListener('mousedown', onMouseDown);
        renderer.domElement.removeEventListener('mousemove', onMouseMove);
        renderer.domElement.removeEventListener('mouseup', onMouseUp);
        renderer.domElement.removeEventListener('wheel', onWheel);
      };

      // Animation loop
      const animate = () => {
        animationFrameRef.current = requestAnimationFrame(animate);
        renderer.render(scene, camera);
      };
      animate();

      // Cleanup
      return () => {
        cleanupControls();
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    } else {
      // For top and first-person views, just render once
      const animate = () => {
        animationFrameRef.current = requestAnimationFrame(animate);
        renderer.render(scene, camera);
      };
      animate();

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
  }, [variant, viewMode]); // Re-run when variant or viewMode changes

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && cameraRef.current && rendererRef.current) {
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        
        if (cameraRef.current instanceof THREE.PerspectiveCamera) {
          cameraRef.current.aspect = width / height;
          cameraRef.current.updateProjectionMatrix();
        }
        
        rendererRef.current.setSize(width, height);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const createHouseFromPlan = (imageSrc, scene) => {
    console.log('Loading blueprint image from:', imageSrc);
    setIsLoading(true);
    
    // Use fetch + blob URL to avoid CORS/tainting issues
    // This ensures the image is loaded as same-origin data
    fetch(imageSrc)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.blob();
      })
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        console.log('Image fetched as blob, creating object URL');
        
        const img = new Image();
        
        img.onload = function() {
          console.log('Blueprint image loaded successfully, dimensions:', img.width, 'x', img.height);
          
          // Clear previous models (keep lights) - matching HTML code exactly
          scene.children.forEach((child, index) => {
            if (index > 2) scene.remove(child);
          });

          // Create texture for displaying the plan (use blob URL)
          const textureLoader = new THREE.TextureLoader();
          textureLoader.load(blobUrl, function(texture) {
            const planeGeometry = new THREE.PlaneGeometry(20, 20);
            const planeMaterial = new THREE.MeshBasicMaterial({ 
              map: texture,
              side: THREE.DoubleSide
            });
            const planPlane = new THREE.Mesh(planeGeometry, planeMaterial);
            planPlane.rotation.x = -Math.PI / 2;
            planPlane.position.y = 0.1;
            scene.add(planPlane);
          });

          // Create canvas for image analysis (оптимизированное разрешение для производительности)
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const analysisSize = 300;
          canvas.width = analysisSize;
          canvas.height = analysisSize;
          
          // Draw image to canvas - blob URL is same-origin, so no tainting
          ctx.drawImage(img, 0, 0, analysisSize, analysisSize);
          
          // Get image data - this should work now since blob URL is same-origin
          const imageData = ctx.getImageData(0, 0, analysisSize, analysisSize);
          
          console.log('Image data extracted successfully, creating walls...');
          // Create walls from image
          createWallsFromImage(imageData, analysisSize, analysisSize, scene);
          
          // Clean up blob URL
          URL.revokeObjectURL(blobUrl);
          setIsLoading(false);
        };
        
        img.onerror = function(error) {
          console.error('Failed to load image from blob URL:', error);
          URL.revokeObjectURL(blobUrl);
          createDefaultHouse(scene);
          setIsLoading(false);
        };
        
        img.src = blobUrl;
      })
      .catch(error => {
        console.error('Failed to fetch image:', error);
        console.error('Image URL:', imageSrc);
        createDefaultHouse(scene);
        setIsLoading(false);
      });
  };

  const createWallsFromImage = (imageData, width, height, scene) => {
    const data = imageData.data;
    const wallMap = new Array(width * height).fill(false);
    
    // Analyze each pixel
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIndex = (y * width + x) * 4;
        const r = data[pixelIndex];
        const g = data[pixelIndex + 1];
        const b = data[pixelIndex + 2];
        
        // If pixel is dark - it's a wall
        if (r < 50 && g < 50 && b < 50) {
          wallMap[y * width + x] = true;
        }
      }
    }
    
    // Create walls from pixels
    createWallsFromPixels(wallMap, width, height, scene);
  };

  const createWallsFromPixels = (wallMap, width, height, scene) => {
    const scale = 20;
    const pixelSize = scale / width;
    const wallHeight = 3;
    const step = 1;
    
    const externalWalls = [];
    const internalWalls = [];
    
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const idx = y * width + x;
        
        if (wallMap[idx]) {
          if (isBoundaryPixel(wallMap, width, height, x, y)) {
            const worldX = (x / width - 0.5) * scale;
            const worldZ = (y / height - 0.5) * scale;
            
            const isExternal = isExternalWall(wallMap, width, height, x, y);
            
            if (isExternal) {
              externalWalls.push({ x: worldX, z: worldZ });
            } else {
              internalWalls.push({ x: worldX, z: worldZ });
            }
          }
        }
      }
    }
    
    if (externalWalls.length > 0 || internalWalls.length > 0) {
      createOptimizedWalls(externalWalls, internalWalls, pixelSize, wallHeight, scene);
    } else {
      createDefaultHouse(scene);
    }
  };

  const isExternalWall = (wallMap, width, height, x, y) => {
    if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
      return true;
    }
    
    const margin = Math.min(width, height) * 0.05;
    if (x < margin || x > width - margin || y < margin || y > height - margin) {
      return true;
    }
    
    const neighbors = [
      [x, y - 1], [x, y + 1],
      [x - 1, y], [x + 1, y]
    ];
    
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
        return true;
      }
      if (!wallMap[ny * width + nx]) {
        if (nx < margin || nx > width - margin || ny < margin || ny > height - margin) {
          return true;
        }
      }
    }
    
    return false;
  };

  const createOptimizedWalls = (externalWalls, internalWalls, pixelSize, wallHeight, scene) => {
    const externalMaterial = new THREE.MeshPhongMaterial({ 
      color: 0xff0000,
      specular: 0x111111,
      shininess: 30
    });
    
    const internalMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x00ff00,
      specular: 0x111111,
      shininess: 30
    });
    
    const externalGroup = new THREE.Group();
    const internalGroup = new THREE.Group();
    
    const boxGeometry = new THREE.BoxGeometry(pixelSize, wallHeight, pixelSize);
    
    externalWalls.forEach(wall => {
      const wallMesh = new THREE.Mesh(boxGeometry, externalMaterial);
      wallMesh.position.set(wall.x, 1.5, wall.z);
      externalGroup.add(wallMesh);
    });
    
    internalWalls.forEach(wall => {
      const wallMesh = new THREE.Mesh(boxGeometry, internalMaterial);
      wallMesh.position.set(wall.x, 1.5, wall.z);
      internalGroup.add(wallMesh);
    });
    
    if (externalWalls.length > 0) {
      scene.add(externalGroup);
    }
    if (internalWalls.length > 0) {
      scene.add(internalGroup);
    }
  };

  const isBoundaryPixel = (wallMap, width, height, x, y) => {
    const neighbors = [
      [x, y - 1], [x, y + 1],
      [x - 1, y], [x + 1, y]
    ];
    
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
        return true;
      }
      if (!wallMap[ny * width + nx]) {
        return true;
      }
    }
    
    return false;
  };

  const createDefaultHouse = (scene) => {
    const wallGeometry = new THREE.BoxGeometry(10, 3, 8);
    const wallMaterial = new THREE.MeshPhongMaterial({ color: 0xC4A484 });
    const walls = new THREE.Mesh(wallGeometry, wallMaterial);
    walls.position.y = 1.5;
    scene.add(walls);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rendererRef.current && containerRef.current && containerRef.current.contains(rendererRef.current.domElement)) {
        containerRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Get blueprint URL from variant - try multiple paths
  const blueprintUrl = variant?.aiRequest?.plan?.fileUrl || variant?.thumbnailUrl;
  
  if (!blueprintUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-gray-600">No blueprint image available</div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75 z-10">
          <div className="text-gray-600">Loading 3D model...</div>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};
