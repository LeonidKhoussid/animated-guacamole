import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import apiClient from '../utils/apiClient.js';

THREE.Cache.enabled = true;

export const ThreeDViewer = ({ variant, viewMode = '3d', planGeometry = null }) => {
const ORTHO_FRUSTUM_SIZE = 18;
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const animationFrameRef = useRef(null);
  const wallGroupsRef = useRef({ external: null, internal: null });
  const wallsDataRef = useRef({ external: [], internal: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [modelWarning, setModelWarning] = useState(null);
  const apartmentModelRef = useRef(null);
  const modelBoundsRef = useRef(null);
  const joystickStateRef = useRef({
    active: false,
    vx: 0,
    vz: 0,
  });
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0, active: false });
  const movementStateRef = useRef({
    forward: false,
    back: false,
    left: false,
    right: false,
    yaw: 0,
    pitch: 0,
    isMouseDown: false,
    lastX: 0,
    lastY: 0,
  });
  const clockRef = useRef(new THREE.Clock());

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

  // Helper for any asset (images/models) via backend proxy to bypass CORS
  const getProxyAssetUrl = (assetUrl) => {
    if (!assetUrl) return null;
    if (assetUrl.startsWith('http://localhost') || assetUrl.startsWith('/plans/proxy')) {
      return assetUrl;
    }
    const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
    return `${backendUrl}/plans/proxy?url=${encodeURIComponent(assetUrl)}`;
  };

  useEffect(() => {
    // Get blueprint URL from variant - try multiple paths (for fallback)
    const originalUrl = variant?.aiRequest?.plan?.fileUrl || variant?.thumbnailUrl || null;
    const blueprintUrl = getProxyImageUrl(originalUrl);
    
    // Get planGeometry from prop or variant
    const geometry = planGeometry || variant?.planGeometry;
    
    console.log('ThreeDViewer useEffect - Original URL:', originalUrl);
    console.log('ThreeDViewer useEffect - Proxy URL:', blueprintUrl);
    console.log('ThreeDViewer useEffect - Has geometry:', !!geometry);
    console.log('Container ref:', !!containerRef.current);
    
    setIsLoading(true);

    if (!containerRef.current) {
      console.warn('Cannot initialize viewer - missing container');
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
      const width = containerRef.current.clientWidth || 1;
      const height = containerRef.current.clientHeight || 1;
      const aspect = width / height;
      const frustum = ORTHO_FRUSTUM_SIZE;
      camera = new THREE.OrthographicCamera(
        (-frustum * aspect) / 2,
        (frustum * aspect) / 2,
        frustum / 2,
        -frustum / 2,
        0.1,
        2000
      );
      camera.position.set(0, 20, 0);
      camera.lookAt(0, 0, 0);
    } else if (viewMode === 'first-person') {
      camera = new THREE.PerspectiveCamera(75, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 1000);
      const startPos = getFirstPersonStartPosition();
      camera.position.set(startPos.x, startPos.y, startPos.z);
      movementStateRef.current.yaw = 0;
      movementStateRef.current.pitch = 0;
      camera.rotation.set(0, 0, 0, 'YXZ');
    } else {
      camera = new THREE.PerspectiveCamera(75, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 1000);
      camera.position.set(0, 8, 12);
      camera.lookAt(0, 0, 0);
    }
    cameraRef.current = camera;

    // Initialize renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    // Ensure correct color space for textures (compat with older three versions)
    if ('outputColorSpace' in renderer) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.2));
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 15);
    scene.add(directionalLight);
    const helper = new THREE.GridHelper(50, 50, 0x888888, 0x444444);
    helper.position.y = 0.01;
    scene.add(helper);
    const axes = new THREE.AxesHelper(2);
    axes.position.y = 0.01;
    scene.add(axes);

    // Load furnished apartment model (USDZ)
    loadApartmentModel(scene);

    // Only render structured geometry when available; otherwise rely on 3D model
    if (geometry) {
      console.log('Using structured geometry to create walls');
      createWallsFromGeometry(geometry, scene);
      setIsLoading(false);
    } else {
      // No geometry; keep the 3D model only
      setIsLoading(false);
    }

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
        if (apartmentModelRef.current) {
          scene.remove(apartmentModelRef.current);
        }
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    } else if (viewMode === 'first-person') {
      const movement = movementStateRef.current;

      const onKeyDown = (e) => {
        switch (e.code) {
          case 'KeyW':
          case 'ArrowUp':
            movement.forward = true;
            break;
          case 'KeyS':
          case 'ArrowDown':
            movement.back = true;
            break;
          case 'KeyA':
          case 'ArrowLeft':
            movement.left = true;
            break;
          case 'KeyD':
          case 'ArrowRight':
            movement.right = true;
            break;
          default:
            break;
        }
      };

      const onKeyUp = (e) => {
        switch (e.code) {
          case 'KeyW':
          case 'ArrowUp':
            movement.forward = false;
            break;
          case 'KeyS':
          case 'ArrowDown':
            movement.back = false;
            break;
          case 'KeyA':
          case 'ArrowLeft':
            movement.left = false;
            break;
          case 'KeyD':
          case 'ArrowRight':
            movement.right = false;
            break;
          default:
            break;
        }
      };

      const onMouseDown = (e) => {
        movement.isMouseDown = true;
        movement.lastX = e.clientX;
        movement.lastY = e.clientY;
      };

      const onMouseUp = () => {
        movement.isMouseDown = false;
      };

      const onMouseMove = (e) => {
        if (!movement.isMouseDown) return;
        const deltaX = e.clientX - movement.lastX;
        const deltaY = e.clientY - movement.lastY;

        movement.yaw -= deltaX * 0.0025;
        movement.pitch -= deltaY * 0.0025;
        movement.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, movement.pitch));

        camera.rotation.set(movement.pitch, movement.yaw, 0, 'YXZ');

        movement.lastX = e.clientX;
        movement.lastY = e.clientY;
      };

      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      renderer.domElement.addEventListener('mousedown', onMouseDown);
      renderer.domElement.addEventListener('mouseup', onMouseUp);
      renderer.domElement.addEventListener('mousemove', onMouseMove);

      const animate = () => {
        animationFrameRef.current = requestAnimationFrame(animate);

        const delta = clockRef.current.getDelta();
        const speed = 4;
        const direction = new THREE.Vector3();

        direction.z = Number(movement.forward) - Number(movement.back);
        direction.x = Number(movement.right) - Number(movement.left);
        // Joystick vector (from on-screen control)
        direction.x += joystickStateRef.current.vx;
        direction.z += joystickStateRef.current.vz;

        if (direction.lengthSq() > 0) {
          direction.normalize();
          const moveX = direction.x * speed * delta;
          const moveZ = direction.z * speed * delta;

          camera.translateX(moveX);
          camera.translateZ(-moveZ);
        }

        renderer.render(scene, camera);
      };
      animate();

      return () => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        renderer.domElement.removeEventListener('mousedown', onMouseDown);
        renderer.domElement.removeEventListener('mouseup', onMouseUp);
        renderer.domElement.removeEventListener('mousemove', onMouseMove);
        if (apartmentModelRef.current) {
          scene.remove(apartmentModelRef.current);
        }
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    } else {
      // For top view, just render once
      const animate = () => {
        animationFrameRef.current = requestAnimationFrame(animate);
        renderer.render(scene, camera);
      };
      animate();

      return () => {
        if (apartmentModelRef.current) {
          scene.remove(apartmentModelRef.current);
        }
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
  }, [variant, viewMode, planGeometry]); // Re-run when variant, viewMode, or planGeometry changes

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && cameraRef.current && rendererRef.current) {
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        
        if (cameraRef.current instanceof THREE.PerspectiveCamera) {
          cameraRef.current.aspect = width / height;
          cameraRef.current.updateProjectionMatrix();
        } else if (cameraRef.current instanceof THREE.OrthographicCamera) {
          const aspect = width / height;
          const frustum = ORTHO_FRUSTUM_SIZE;
          cameraRef.current.left = (-frustum * aspect) / 2;
          cameraRef.current.right = (frustum * aspect) / 2;
          cameraRef.current.top = frustum / 2;
          cameraRef.current.bottom = -frustum / 2;
          cameraRef.current.updateProjectionMatrix();
        }
        
        rendererRef.current.setSize(width, height);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Create walls from structured geometry data
  const createWallsFromGeometry = (planGeometry, scene) => {
    if (!planGeometry || !planGeometry.geometry || !planGeometry.geometry.walls) {
      console.warn('Invalid plan geometry provided');
      setIsLoading(false);
      return;
    }

    const walls = planGeometry.geometry.walls;
    const bearingWalls = walls.filter(w => w.isBearing);
    const nonBearingWalls = walls.filter(w => !w.isBearing);

    console.log('\n========== 3D VIEWER: BUILDING WALLS FROM GEOMETRY ==========');
    console.log(`📐 Total walls: ${walls.length}`);
    console.log(`🚫 Bearing walls (CANNOT CHANGE): ${bearingWalls.length} - shown in RED`);
    console.log(`✅ Non-bearing walls (CAN CHANGE): ${nonBearingWalls.length} - shown in GREEN`);
    
    if (bearingWalls.length > 0) {
      console.log('\n⚠️  IMPORTANT: The following walls are BEARING (load-bearing) and CANNOT be modified:');
      bearingWalls.forEach((wall, idx) => {
        console.log(`  ${idx + 1}. Wall ID: ${wall.id || 'unnamed'}`);
        console.log(`     - Position: from (${wall.start.x}m, ${wall.start.y}m) to (${wall.end.x}m, ${wall.end.y}m)`);
        console.log(`     - Dimensions: height=${wall.height || 2.7}m, thickness=${wall.thickness || 0.15}m`);
        console.log(`     - ⛔ This wall supports the building structure - DO NOT modify!`);
      });
    }
    
    if (nonBearingWalls.length > 0) {
      console.log('\n✅ The following walls are NON-BEARING and CAN be modified:');
      nonBearingWalls.forEach((wall, idx) => {
        console.log(`  ${idx + 1}. Wall ID: ${wall.id || 'unnamed'}`);
        console.log(`     - Position: from (${wall.start.x}m, ${wall.start.y}m) to (${wall.end.x}m, ${wall.end.y}m)`);
        console.log(`     - Dimensions: height=${wall.height || 2.7}m, thickness=${wall.thickness || 0.15}m`);
      });
    }
    
    console.log('===========================================================\n');

    // Clear previous models (keep lights)
    scene.children.forEach((child, index) => {
      if (index > 2) scene.remove(child);
    });

    const externalGroup = new THREE.Group();
    const internalGroup = new THREE.Group();

    // Material for bearing walls (red)
    const bearingMaterial = new THREE.MeshPhongMaterial({ 
      color: 0xff0000,
      specular: 0x111111,
      shininess: 30
    });

    // Material for non-bearing walls (green)
    const nonBearingMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x00ff00,
      specular: 0x111111,
      shininess: 30
    });

    walls.forEach((wall) => {
      // Validate wall data
      if (!wall.start || !wall.end || wall.start.x === undefined || wall.start.y === undefined || 
          wall.end.x === undefined || wall.end.y === undefined) {
        console.warn('Invalid wall data, skipping:', wall);
        return;
      }

      const start = new THREE.Vector3(wall.start.x, 0, wall.start.y);
      const end = new THREE.Vector3(wall.end.x, 0, wall.end.y);
      
      // Calculate wall length and direction
      const direction = new THREE.Vector3().subVectors(end, start);
      const length = direction.length();
      
      // Skip zero-length walls
      if (length < 0.01) {
        console.warn('Wall has zero or near-zero length, skipping:', wall);
        return;
      }

      const height = wall.height || 2.7;
      const thickness = wall.thickness || 0.15;

      // Normalize direction for rotation
      direction.normalize();

      // Create wall geometry
      const wallGeometry = new THREE.BoxGeometry(length, height, thickness);
      const wallMesh = new THREE.Mesh(
        wallGeometry,
        wall.isBearing ? bearingMaterial : nonBearingMaterial
      );

      // Position wall at midpoint
      const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
      wallMesh.position.set(midpoint.x, height / 2, midpoint.z);

      // Rotate wall to align with direction
      // Calculate angle from direction vector
      const angle = Math.atan2(direction.x, direction.z);
      wallMesh.rotation.y = angle;

      // Add to appropriate group
      if (wall.isBearing) {
        externalGroup.add(wallMesh);
      } else {
        internalGroup.add(wallMesh);
      }
    });

    if (externalGroup.children.length > 0) {
      scene.add(externalGroup);
    }
    if (internalGroup.children.length > 0) {
      scene.add(internalGroup);
    }

    console.log(`✅ 3D Scene created successfully:`);
    console.log(`   - ${externalGroup.children.length} bearing wall(s) rendered in RED`);
    console.log(`   - ${internalGroup.children.length} non-bearing wall(s) rendered in GREEN`);
    console.log(`\n💡 Visual guide: RED walls = cannot change, GREEN walls = can modify\n`);
  };

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
            const imgAspect = img.width / img.height || 1;
            const baseSize = 20;
            const planeHeight = baseSize;
            const planeWidth = baseSize * imgAspect;

            const planeGeometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
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
          const imgAspect = img.width / img.height || 1;
          if (imgAspect >= 1) {
            canvas.width = analysisSize * imgAspect;
            canvas.height = analysisSize;
          } else {
            canvas.width = analysisSize;
            canvas.height = analysisSize / imgAspect;
          }
          
          // Draw image to canvas - blob URL is same-origin, so no tainting
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // Get image data - this should work now since blob URL is same-origin
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          
          console.log('Image data extracted successfully, creating walls...');
          // Create walls from image
          const baseSize = 20;
          const planeHeight = baseSize;
          const planeWidth = baseSize * imgAspect;
          createWallsFromImage(imageData, canvas.width, canvas.height, scene, planeWidth, planeHeight);
          
          // Clean up blob URL
          URL.revokeObjectURL(blobUrl);
        };
        
        img.onerror = function(error) {
          console.error('Failed to load image from blob URL:', error);
          URL.revokeObjectURL(blobUrl);
          createDefaultHouse(scene);
        };
        
        img.src = blobUrl;
      })
      .catch(error => {
        console.error('Failed to fetch image:', error);
        console.error('Image URL:', imageSrc);
        createDefaultHouse(scene);
      });
  };

  const createWallsFromImage = (imageData, width, height, scene, scaleX = 20, scaleZ = 20) => {
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
    createWallsFromPixels(wallMap, width, height, scene, scaleX, scaleZ);
  };

  const createWallsFromPixels = (wallMap, width, height, scene, scaleX = 20, scaleZ = 20) => {
    const pixelSizeX = scaleX / width;
    const pixelSizeZ = scaleZ / height;
    const wallHeight = 3;
    const step = 1;
    
    const externalWalls = [];
    const internalWalls = [];
    
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const idx = y * width + x;
        
        if (wallMap[idx]) {
          if (isBoundaryPixel(wallMap, width, height, x, y)) {
            const worldX = (x / width - 0.5) * scaleX;
            const worldZ = (y / height - 0.5) * scaleZ;
            
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
      createOptimizedWalls(externalWalls, internalWalls, pixelSizeX, pixelSizeZ, wallHeight, scene);
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

  const createOptimizedWalls = (externalWalls, internalWalls, pixelSizeX, pixelSizeZ, wallHeight, scene) => {
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
    
    const boxGeometry = new THREE.BoxGeometry(pixelSizeX, wallHeight, pixelSizeZ);
    
    // Store wall data for modifications
    wallsDataRef.current = {
      external: externalWalls.map(w => ({ ...w, pixelSizeX, pixelSizeZ })),
      internal: internalWalls.map(w => ({ ...w, pixelSizeX, pixelSizeZ })),
    };
    
    externalWalls.forEach(wall => {
      const wallMesh = new THREE.Mesh(boxGeometry, externalMaterial);
      wallMesh.position.set(wall.x, 1.5, wall.z);
      wallMesh.userData = { type: 'external', originalPosition: { x: wall.x, z: wall.z } };
      externalGroup.add(wallMesh);
    });
    
    internalWalls.forEach(wall => {
      const wallMesh = new THREE.Mesh(boxGeometry, internalMaterial);
      wallMesh.position.set(wall.x, 1.5, wall.z);
      wallMesh.userData = { type: 'internal', originalPosition: { x: wall.x, z: wall.z } };
      internalGroup.add(wallMesh);
    });
    
    wallGroupsRef.current = { external: externalGroup, internal: internalGroup };
    
    if (externalWalls.length > 0) {
      scene.add(externalGroup);
    }
    if (internalWalls.length > 0) {
      scene.add(internalGroup);
    }
    
    // Fetch and apply modifications after walls are created
    // Add a small delay to ensure walls are fully rendered
    setTimeout(() => {
      if (variant?.id) {
        console.log('Starting to fetch modifications for variant:', variant.id);
        fetchAndApplyModifications(variant.id, scene);
      } else {
        console.warn('No variant ID available for modifications');
      }
    }, 500);
  };

  const fetchAndApplyModifications = async (variantId, scene) => {
    try {
      console.log('Fetching 3D model modifications for variant:', variantId);
      const response = await apiClient.get(`/variants/${variantId}/3d-modifications`);
      const { modifications, instructions } = response.data;
      
      console.log('Got modifications:', modifications);
      console.log('Instructions:', instructions);
      console.log('Full response:', response.data);
      
      if (modifications && modifications.length > 0) {
        applyModifications(modifications, scene);
      } else {
        // Fallback: apply modifications based on variant description
        console.log('No modifications from API, using fallback based on variant description');
        applyFallbackModifications(variant, scene);
      }
    } catch (error) {
      console.error('Failed to fetch modifications:', error);
      console.error('Error details:', error.response?.data || error.message);
      // Fallback: apply modifications based on variant description
      console.log('Using fallback modifications based on variant description');
      applyFallbackModifications(variant, scene);
    }
  };

  const applyFallbackModifications = (variant, scene) => {
    if (!variant) return;
    
    const description = (variant.description || '').toLowerCase();
    const internalGroup = wallGroupsRef.current.internal;
    
    if (!internalGroup || internalGroup.children.length === 0) {
      console.log('No internal walls to modify');
      return;
    }

    console.log('Applying fallback modifications based on description:', description);
    
    // Check for keywords that suggest wall removal
    const mergeKeywords = ['объедин', 'удал', 'снос', 'разруш', 'убрать', 'демонтаж', 'расшир', 'увелич'];
    const shouldRemoveWalls = mergeKeywords.some(keyword => description.includes(keyword));
    
    if (shouldRemoveWalls) {
      // Remove some internal walls (e.g., remove 30-50% of them)
      const wallsToRemove = Math.floor(internalGroup.children.length * 0.4);
      const indicesToRemove = [];
      
      // Select walls to remove (prefer middle walls, not edge walls)
      for (let i = 0; i < wallsToRemove && i < internalGroup.children.length; i++) {
        const index = Math.floor(internalGroup.children.length * 0.3) + i;
        if (index < internalGroup.children.length) {
          indicesToRemove.push(index);
        }
      }
      
      // Remove in reverse order
      indicesToRemove.reverse().forEach(index => {
        const wallMesh = internalGroup.children[index];
        if (wallMesh) {
          internalGroup.remove(wallMesh);
          wallMesh.geometry.dispose();
          wallMesh.material.dispose();
        }
      });
      
      console.log(`Removed ${indicesToRemove.length} internal walls based on variant description`);
    }
  };

  const applyModifications = (modifications, scene) => {
    const externalGroup = wallGroupsRef.current.external;
    const internalGroup = wallGroupsRef.current.internal;
    
    if (!externalGroup && !internalGroup) {
      console.warn('Wall groups not found, cannot apply modifications');
      return;
    }

    modifications.forEach(mod => {
      console.log('Applying modification:', mod);
      
      switch (mod.type) {
        case 'remove_wall':
          if (mod.wallType === 'internal' && internalGroup) {
            // Find and remove walls near the specified position
            const wallsToRemove = [];
            
            if (mod.position && mod.position.x !== undefined && mod.position.z !== undefined) {
              // Remove walls near specific position
              internalGroup.children.forEach((wallMesh, index) => {
                const pos = wallMesh.userData.originalPosition;
                const distance = Math.sqrt(
                  Math.pow(pos.x - mod.position.x, 2) + 
                  Math.pow(pos.z - mod.position.z, 2)
                );
                
                // Remove walls within 3 units of the position
                if (distance < 3) {
                  wallsToRemove.push(index);
                }
              });
            } else {
              // No position specified - remove a percentage of internal walls based on description
              const description = (mod.description || '').toLowerCase();
              let removePercentage = 0.3; // Default: remove 30%
              
              if (description.includes('объедин') || description.includes('удал')) {
                removePercentage = 0.5; // Remove 50% for merging
              }
              
              const countToRemove = Math.floor(internalGroup.children.length * removePercentage);
              // Remove walls from middle section (not edges)
              const startIndex = Math.floor(internalGroup.children.length * 0.25);
              for (let i = 0; i < countToRemove && (startIndex + i) < internalGroup.children.length; i++) {
                wallsToRemove.push(startIndex + i);
              }
            }
            
            // Remove in reverse order to maintain indices
            wallsToRemove.reverse().forEach(index => {
              const wallMesh = internalGroup.children[index];
              if (wallMesh) {
                internalGroup.remove(wallMesh);
                wallMesh.geometry.dispose();
                wallMesh.material.dispose();
              }
            });
            
            console.log(`Removed ${wallsToRemove.length} internal walls (total was ${internalGroup.children.length + wallsToRemove.length})`);
          }
          break;
          
        case 'change_color':
          const color = new THREE.Color(mod.color || 0x00ff00);
          if (mod.wallType === 'internal' && internalGroup) {
            internalGroup.children.forEach(wallMesh => {
              wallMesh.material.color.set(color);
            });
          } else if (mod.wallType === 'external' && externalGroup) {
            externalGroup.children.forEach(wallMesh => {
              wallMesh.material.color.set(color);
            });
          }
          break;
          
        case 'add_wall':
          if (mod.position && mod.wallType === 'internal' && internalGroup) {
            const sample = wallsDataRef.current.internal[0];
            const pixelSizeX = sample?.pixelSizeX || 0.067;
            const pixelSizeZ = sample?.pixelSizeZ || 0.067;
            const wallHeight = 3;
            const boxGeometry = new THREE.BoxGeometry(pixelSizeX, wallHeight, pixelSizeZ);
            const material = new THREE.MeshPhongMaterial({ 
              color: mod.color ? new THREE.Color(mod.color) : 0x00ff00,
              specular: 0x111111,
              shininess: 30
            });
            
            const wallMesh = new THREE.Mesh(boxGeometry, material);
            wallMesh.position.set(mod.position.x || 0, 1.5, mod.position.z || 0);
            wallMesh.userData = { type: 'internal', originalPosition: { x: mod.position.x || 0, z: mod.position.z || 0 } };
            internalGroup.add(wallMesh);
            console.log('Added new internal wall at:', mod.position);
          }
          break;
          
        default:
          console.warn('Unknown modification type:', mod.type);
      }
    });
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

  const getFirstPersonStartPosition = () => {
    const bounds = modelBoundsRef.current;
    if (bounds) {
      const { center, min, max } = bounds;
      const eye = Math.min(Math.max(min.y + 1.5, min.y + 1.0), max.y - 0.2);
      const y = isFinite(eye) ? eye : 1.5;
      return { x: center.x, y, z: center.z };
    }
    return { x: 0, y: 1.5, z: 0 };
  };

  const handleJoystickStart = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const radius = rect.width / 2;
    const clamped = clampJoystick(dx, dy, radius);
    joystickStateRef.current = { active: true, vx: clamped.x / radius, vz: -clamped.y / radius };
    setJoystickPos({ x: clamped.x, y: clamped.y, active: true });
  };

  const handleJoystickMove = (e) => {
    if (!joystickStateRef.current.active) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const radius = rect.width / 2;
    const clamped = clampJoystick(dx, dy, radius);
    joystickStateRef.current = { active: true, vx: clamped.x / radius, vz: -clamped.y / radius };
    setJoystickPos({ x: clamped.x, y: clamped.y, active: true });
  };

  const handleJoystickEnd = () => {
    joystickStateRef.current = { active: false, vx: 0, vz: 0 };
    setJoystickPos({ x: 0, y: 0, active: false });
  };

  const clampJoystick = (dx, dy, radius) => {
    const len = Math.hypot(dx, dy);
    if (len <= radius) return { x: dx, y: dy };
    const scale = radius / (len || 1);
    return { x: dx * scale, y: dy * scale };
  };

  const loadApartmentModel = (scene) => {
    const url = getProxyAssetUrl('https://storage.yandexcloud.net/optika/Untitled.glb');
    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
    dracoLoader.setDecoderConfig({ type: 'js' });
    dracoLoader.preload();
    loader.setDRACOLoader(dracoLoader);
    loader.setMeshoptDecoder(MeshoptDecoder);

    console.log('Loading apartment GLB from:', url);
    setIsLoading(true);
    setModelWarning(null);

    if (apartmentModelRef.current) {
      scene.add(apartmentModelRef.current);
      setIsLoading(false);
      console.log('Reusing cached apartment model');
      return;
    }

    loader.load(
      url,
      (gltf) => {
        const model = gltf.scene || gltf.scenes?.[0];
        if (!model) {
          console.error('GLB loaded but contains no scene');
          setModelWarning('Model loaded but contains no scene.');
          setIsLoading(false);
          return;
        }

        // Remove previous instance if any
        if (apartmentModelRef.current) {
          scene.remove(apartmentModelRef.current);
          disposeObject(apartmentModelRef.current);
        }

        // Center the model on the ground plane
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        console.log('Apartment raw bounds:', { size: size.toArray(), center: center.toArray(), min: box.min.toArray(), max: box.max.toArray() });

        model.position.sub(center);
        model.position.y -= box.min.y;

        // Scale down very large assets or up tiny ones
        const maxDimension = Math.max(size.x, size.y, size.z);
        if (maxDimension > 50) {
          const scale = 50 / maxDimension;
          model.scale.setScalar(scale);
        } else if (maxDimension < 1) {
          // Scale up very tiny assets
          const scale = 5 / Math.max(maxDimension, 0.001);
          model.scale.setScalar(scale);
        }

        let meshCount = 0;
        let childCount = 0;
        // Ensure all meshes are visible; keep existing materials when present
        model.traverse((child) => {
          childCount += 1;
          if (child.isMesh) {
            meshCount += 1;
            child.visible = true;
            // Keep original materials to preserve textures; just ensure update
            if (child.material) {
              child.material.needsUpdate = true;
            }
            child.castShadow = true;
            child.receiveShadow = true;
            // Light optimization: ensure frustum culling is enabled
            child.frustumCulled = true;
          }
        });
        console.log('Apartment children:', childCount, 'meshes:', meshCount);

        // Recompute bounds after transforms/material changes
        const finalBox = new THREE.Box3().setFromObject(model);
        const finalCenter = finalBox.getCenter(new THREE.Vector3());
        const finalSize = finalBox.getSize(new THREE.Vector3());
        console.log('Apartment final bounds:', { size: finalSize.toArray(), center: finalCenter.toArray(), min: finalBox.min.toArray(), max: finalBox.max.toArray() });

        if (meshCount === 0) {
          setModelWarning('Loaded model has 0 meshes. It may be an unsupported USDZ variant; try converting to glTF.');
        } else {
          setModelWarning(null);
        }

        modelBoundsRef.current = {
          center: finalCenter.clone(),
          min: finalBox.min.clone(),
          max: finalBox.max.clone(),
        };

        // Visualize bounds for debugging
        const bboxHelper = new THREE.Box3Helper(finalBox, new THREE.Color(0x00ffff));
        scene.add(bboxHelper);

        scene.add(model);
        apartmentModelRef.current = model;

        // Fit camera to model if we're in 3D view
        if (cameraRef.current && viewMode === '3d') {
          fitCameraToObject(cameraRef.current, model, rendererRef.current, 1.8);
        } else if (cameraRef.current && viewMode === 'first-person') {
          const startPos = getFirstPersonStartPosition();
          cameraRef.current.position.set(startPos.x, startPos.y, startPos.z);
          cameraRef.current.lookAt(finalCenter);
        }

        setIsLoading(false);
        console.log('Apartment model loaded successfully');
      },
      undefined,
      (error) => {
        console.error('Failed to load apartment model:', error);
        setIsLoading(false);
      }
    );
  };

  const fitCameraToObject = (camera, object, renderer, offset = 1.25) => {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));

    cameraZ *= offset;
    camera.position.set(center.x, center.y + maxDim * 0.5, cameraZ);
    camera.lookAt(center);

    if (renderer) {
      camera.updateProjectionMatrix();
      renderer.render(sceneRef.current, camera);
    }
  };

  const disposeObject = (obj) => {
    obj.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => mat.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rendererRef.current && containerRef.current && containerRef.current.contains(rendererRef.current.domElement)) {
        containerRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
      if (apartmentModelRef.current && sceneRef.current) {
        sceneRef.current.remove(apartmentModelRef.current);
        disposeObject(apartmentModelRef.current);
        apartmentModelRef.current = null;
      }
      joystickStateRef.current = { active: false, vx: 0, vz: 0 };
      setIsLoading(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Get blueprint URL from variant - try multiple paths
  const blueprintUrl = variant?.aiRequest?.plan?.fileUrl || variant?.thumbnailUrl;

  return (
    <div className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75 z-10">
          <div className="flex flex-col items-center gap-3 text-gray-700">
            <div className="w-10 h-10 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-sm font-medium">Loading 3D model...</span>
          </div>
        </div>
      )}
      {modelWarning && (
        <div className="absolute inset-0 pointer-events-none flex items-start justify-end p-4 z-20">
          <div className="bg-yellow-100 text-yellow-800 text-sm px-3 py-2 rounded shadow">
            {modelWarning}
          </div>
        </div>
      )}
      {viewMode === 'first-person' && (
        <div className="absolute bottom-4 left-4 z-20 select-none">
          <div
            className="w-24 h-24 rounded-full bg-black/10 border border-white/50 relative touch-none"
            style={{ touchAction: 'none' }}
            onPointerDown={(e) => handleJoystickStart(e)}
            onPointerMove={(e) => handleJoystickMove(e)}
            onPointerUp={(e) => handleJoystickEnd(e)}
            onPointerCancel={(e) => handleJoystickEnd(e)}
            onPointerLeave={(e) => handleJoystickEnd(e)}>
            <div
              className="w-12 h-12 rounded-full bg-white/70 border border-gray-400 absolute"
              style={{
                left: `calc(50% - 24px + ${joystickPos.x}px)`,
                top: `calc(50% - 24px + ${joystickPos.y}px)`,
                transition: joystickPos.active ? 'none' : 'transform 0.15s ease, left 0.15s ease, top 0.15s ease',
              }}
            />
          </div>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};
