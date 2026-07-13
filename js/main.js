/**
 * VGU Map - Digital Twin Facility Inspection System
 * Vanilla JavaScript + Three.js Implementation
 * 
 * Core Features:
 * - Cartesian coordinate normalization for map_data.json
 * - Three.js OrthographicCamera for top-down architectural view
 * - Room polygon rendering with ExtrudeGeometry and wireframe materials
 * - Raycaster-based room selection
 * - Dynamic UI panel with info_data.json integration
 * - Hologram/TRON aesthetic with VGU Orange (#F37021) and Cyber Cyan
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

const COLORS = {
  VGU_ORANGE: 0xF37021,
  CYBER_CYAN: 0x00FFFF,
  VGU_BLUE: 0x002554,
  BLACK: 0x000000,
  WHITE: 0xFFFFFF
};

const CONFIG = {
  ROOM_HEIGHT: 10, // Extrusion height for rooms
  HOLOGRAM_OPACITY: 0.3,
  WIREFRAME_LINE_WIDTH: 2,
  CAMERA_ZOOM: 0.002, // Initial zoom level for orthographic camera
  RAYCASTER_THRESHOLD: 0.1,
  ANIMATION_DURATION: 300 // ms for UI transitions
};

// ============================================================================
// GLOBAL STATE
// ============================================================================

const state = {
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  raycaster: null,
  mouse: new THREE.Vector2(),
  roomMeshes: [], // Array of room mesh objects
  selectedRoom: null,
  infoData: null, // Loaded info_data.json
  mapData: null, // Loaded map_data.json
  boundingBox: null, // For coordinate normalization
  isMobile: window.innerWidth < 768
};

// ============================================================================
// COORDINATE NORMALIZATION
// ============================================================================

/**
 * Calculate the bounding box of all coordinates in map_data.json
 * This is essential for normalizing Cartesian (meter-based) coordinates
 * to center them at (0,0,0) in the Three.js scene.
 */
function calculateBoundingBox(mapData) {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  mapData.forEach(segment => {
    const { StartX, StartY, EndX, EndY } = segment;
    minX = Math.min(minX, StartX, EndX);
    maxX = Math.max(maxX, StartX, EndX);
    minY = Math.min(minY, StartY, EndY);
    maxY = Math.max(maxY, StartY, EndY);
  });

  return { minX, maxX, minY, maxY };
}

/**
 * Normalize a coordinate point to centered Three.js space
 * @param {number} x - Original X coordinate (meters)
 * @param {number} y - Original Y coordinate (meters)
 * @returns {object} Normalized {x, z} coordinates (Y becomes Z in Three.js)
 */
function normalizeCoordinate(x, y) {
  const { minX, maxX, minY, maxY } = state.boundingBox;
  
  // Calculate center point
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  
  // Translate to center and flip Y axis (Three.js Y is up, we use Z for floor plan)
  const normalizedX = x - centerX;
  const normalizedZ = -(y - centerY); // Negate to maintain proper orientation
  
  return { x: normalizedX, z: normalizedZ };
}

// ============================================================================
// DATA LOADING
// ============================================================================

/**
 * Load JSON data with progress tracking
 */
async function loadJSON(url, progressCallback) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`[DATA] Failed to load ${url}:`, error);
    throw error;
  }
}

/**
 * Initialize and load all required data
 */
async function initializeData() {
  updateLoadingStatus('Loading map geometry...');
  updateLoadingProgress(20);
  
  try {
    // Load map_data.json (room polygons)
    state.mapData = await loadJSON('./map_data.json');
    updateLoadingProgress(50);
    
    // Calculate bounding box for coordinate normalization
    state.boundingBox = calculateBoundingBox(state.mapData);
    console.log('[GEO] Bounding Box:', state.boundingBox);
    
    updateLoadingStatus('Loading room information...');
    
    // Load info_data.json (room details)
    state.infoData = await loadJSON('./info_data.json');
    updateLoadingProgress(80);
    
    console.log('[DATA] Loaded', state.mapData.length, 'map segments');
    console.log('[DATA] Loaded', state.infoData.data?.length || 0, 'room records');
    
    updateLoadingProgress(100);
    return true;
  } catch (error) {
    showError('Failed to load map data. Please check your connection.');
    return false;
  }
}

// ============================================================================
// THREE.JS SCENE SETUP
// ============================================================================

/**
 * Initialize the Three.js scene, camera, renderer, and controls
 */
function initThreeJS() {
  const container = document.getElementById('map-container');
  
  // Scene
  state.scene = new THREE.Scene();
  state.scene.background = new THREE.Color(COLORS.VGU_BLUE);
  state.scene.fog = new THREE.Fog(COLORS.VGU_BLUE, 500, 2000);
  
  // Orthographic Camera for top-down architectural view
  const aspect = container.clientWidth / container.clientHeight;
  const frustumSize = 1000; // Adjust based on desired zoom level
  state.camera = new THREE.OrthographicCamera(
    -frustumSize * aspect / 2,
    frustumSize * aspect / 2,
    frustumSize / 2,
    -frustumSize / 2,
    0.1,
    5000
  );
  state.camera.position.set(0, 500, 0); // Top-down view
  state.camera.lookAt(0, 0, 0);
  
  // Renderer
  state.renderer = new THREE.WebGLRenderer({ 
    antialias: true, 
    alpha: true,
    preserveDrawingBuffer: true 
  });
  state.renderer.setSize(container.clientWidth, container.clientHeight);
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  state.renderer.setClearColor(COLORS.VGU_BLUE, 1);
  container.appendChild(state.renderer.domElement);
  
  // Orbit Controls
  state.controls = new OrbitControls(state.camera, state.renderer.domElement);
  state.controls.enableDamping = true;
  state.controls.dampingFactor = 0.05;
  state.controls.screenSpacePanning = true;
  state.controls.mouseButtons = {
    LEFT: THREE.MOUSE.PAN,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.ROTATE
  };
  state.controls.maxPolarAngle = Math.PI / 2; // Prevent going below ground
  state.controls.minPolarAngle = 0; // Keep top-down view
  
  // Raycaster for interaction
  state.raycaster = new THREE.Raycaster();
  
  // Lighting (for extruded geometry)
  const ambientLight = new THREE.AmbientLight(COLORS.WHITE, 0.5);
  state.scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(COLORS.WHITE, 1);
  directionalLight.position.set(100, 200, 100);
  state.scene.add(directionalLight);
  
  // Grid helper for reference
  const gridHelper = new THREE.GridHelper(1000, 50, COLORS.CYBER_CYAN, COLORS.VGU_ORANGE);
  gridHelper.position.y = -0.1;
  state.scene.add(gridHelper);
  
  // Handle window resize
  window.addEventListener('resize', onWindowResize);
  
  // Handle mouse/click interaction
  state.renderer.domElement.addEventListener('pointerdown', onPointerDown);
  state.renderer.domElement.addEventListener('pointermove', onPointerMove);
  
  // Start animation loop
  animate();
}

/**
 * Handle window resize events
 */
function onWindowResize() {
  const container = document.getElementById('map-container');
  const aspect = container.clientWidth / container.clientHeight;
  const frustumSize = 1000;
  
  state.camera.left = -frustumSize * aspect / 2;
  state.camera.right = frustumSize * aspect / 2;
  state.camera.top = frustumSize / 2;
  state.camera.bottom = -frustumSize / 2;
  state.camera.updateProjectionMatrix();
  
  state.renderer.setSize(container.clientWidth, container.clientHeight);
  
  // Update mobile/desktop detection
  state.isMobile = window.innerWidth < 768;
}

// ============================================================================
// ROOM GEOMETRY GENERATION
// ============================================================================

/**
 * Group map segments by room number and loop index
 * Returns a map of roomNumber -> array of loops (each loop is an array of points)
 */
function groupSegmentsByRoom(mapData) {
  const roomGroups = new Map();
  
  mapData.forEach(segment => {
    const { Room_Number, Loop_Index, StartX, StartY, EndX, EndY } = segment;
    
    if (!roomGroups.has(Room_Number)) {
      roomGroups.set(Room_Number, new Map());
    }
    
    const loops = roomGroups.get(Room_Number);
    if (!loops.has(Loop_Index)) {
      loops.set(Loop_Index, []);
    }
    
    const loop = loops.get(Loop_Index);
    
    // Add start point if it's the first segment or different from last point
    if (loop.length === 0) {
      loop.push({ x: StartX, y: StartY });
    }
    
    // Add end point
    loop.push({ x: EndX, y: EndY });
  });
  
  // Convert to simpler structure
  const result = {};
  roomGroups.forEach((loops, roomNumber) => {
    result[roomNumber] = [];
    loops.forEach((loopPoints, loopIndex) => {
      result[roomNumber].push(loopPoints);
    });
  });
  
  return result;
}

/**
 * Create room meshes from grouped segments
 * Uses ExtrudeGeometry for volume and wireframe materials for hologram effect
 */
function createRoomMeshes(roomGroups) {
  Object.entries(roomGroups).forEach(([roomNumber, loops]) => {
    loops.forEach((loopPoints, loopIndex) => {
      if (loopPoints.length < 3) return; // Need at least 3 points for a polygon
      
      // Normalize all points
      const normalizedPoints = loopPoints.map(point => {
        const normalized = normalizeCoordinate(point.x, point.y);
        return new THREE.Vector2(normalized.x, normalized.z);
      });
      
      // Create shape from points
      const shape = new THREE.Shape(normalizedPoints);
      
      // Extrude geometry for 3D volume
      const extrudeSettings = {
        depth: CONFIG.ROOM_HEIGHT,
        bevelEnabled: false
      };
      
      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      
      // Hologram material - VGU Orange with transparency
      const material = new THREE.MeshPhongMaterial({
        color: COLORS.VGU_ORANGE,
        transparent: true,
        opacity: CONFIG.HOLOGRAM_OPACITY,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      
      // Wireframe overlay - Cyber Cyan
      const wireframeMaterial = new THREE.LineBasicMaterial({
        color: COLORS.CYBER_CYAN,
        linewidth: CONFIG.WIREFRAME_LINE_WIDTH,
        transparent: true,
        opacity: 0.8
      });
      
      // Create mesh
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = 0; // Place at ground level
      
      // Create wireframe edges
      const edgesGeometry = new THREE.EdgesGeometry(geometry);
      const wireframe = new THREE.LineSegments(edgesGeometry, wireframeMaterial);
      wireframe.position.copy(mesh.position);
      
      // Group mesh and wireframe
      const roomGroup = new THREE.Group();
      roomGroup.add(mesh);
      roomGroup.add(wireframe);
      
      // Store room metadata for raycasting
      roomGroup.userData = {
        room_id: roomNumber,
        loop_index: loopIndex,
        isRoom: true
      };
      
      // Store reference for later selection highlighting
      roomGroup.mesh = mesh;
      roomGroup.wireframe = wireframe;
      
      state.scene.add(roomGroup);
      state.roomMeshes.push(roomGroup);
    });
  });
  
  console.log('[RENDER] Created', state.roomMeshes.length, 'room meshes');
}

/**
 * Build the complete 3D map from map_data.json
 */
function buildMap() {
  const roomGroups = groupSegmentsByRoom(state.mapData);
  createRoomMeshes(roomGroups);
  
  // Center camera on the scene
  fitCameraToSelection();
}

/**
 * Adjust camera to fit all room meshes in view
 */
function fitCameraToSelection() {
  if (state.roomMeshes.length === 0) return;
  
  const box = new THREE.Box3();
  state.roomMeshes.forEach(mesh => {
    box.expandByObject(mesh);
  });
  
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  
  // Position camera above center
  state.camera.position.set(center.x, 500, center.z);
  state.controls.target.copy(center);
  state.controls.update();
}

// ============================================================================
// INTERACTION (RAYCASTER)
// ============================================================================

/**
 * Handle pointer down events for room selection
 */
function onPointerDown(event) {
  // Calculate mouse position in normalized device coordinates
  const rect = state.renderer.domElement.getBoundingClientRect();
  state.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  state.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
  // Update raycaster
  state.raycaster.setFromCamera(state.mouse, state.camera);
  
  // Get intersected objects
  const intersects = state.raycaster.intersectObjects(state.roomMeshes, true);
  
  if (intersects.length > 0) {
    // Find the parent group with userData
    let selectedGroup = intersects[0].object;
    while (selectedGroup.parent && !selectedGroup.userData.isRoom) {
      selectedGroup = selectedGroup.parent;
    }
    
    if (selectedGroup.userData.isRoom) {
      selectRoom(selectedGroup);
    }
  }
}

/**
 * Handle pointer move for hover effects
 */
function onPointerMove(event) {
  const rect = state.renderer.domElement.getBoundingClientRect();
  state.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  state.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
  state.raycaster.setFromCamera(state.mouse, state.camera);
  const intersects = state.raycaster.intersectObjects(state.roomMeshes, true);
  
  // Reset all rooms to default opacity
  state.roomMeshes.forEach(group => {
    if (group !== state.selectedRoom) {
      group.mesh.material.opacity = CONFIG.HOLOGRAM_OPACITY;
    }
  });
  
  if (intersects.length > 0) {
    document.body.style.cursor = 'pointer';
    
    let hoveredGroup = intersects[0].object;
    while (hoveredGroup.parent && !hoveredGroup.userData.isRoom) {
      hoveredGroup = hoveredGroup.parent;
    }
    
    if (hoveredGroup && hoveredGroup !== state.selectedRoom) {
      hoveredGroup.mesh.material.opacity = CONFIG.HOLOGRAM_OPACITY + 0.2;
    }
  } else {
    document.body.style.cursor = 'default';
  }
}

/**
 * Select a room and display its information
 * @param {THREE.Group} roomGroup - The selected room group
 */
function selectRoom(roomGroup) {
  // Deselect previous room
  if (state.selectedRoom && state.selectedRoom !== roomGroup) {
    state.selectedRoom.mesh.material.opacity = CONFIG.HOLOGRAM_OPACITY;
    state.selectedRoom.wireframe.material.color.setHex(COLORS.CYBER_CYAN);
  }
  
  // Select new room
  state.selectedRoom = roomGroup;
  roomGroup.mesh.material.opacity = CONFIG.HOLOGRAM_OPACITY + 0.3;
  roomGroup.wireframe.material.color.setHex(COLORS.VGU_ORANGE);
  
  // Get room ID and fetch info
  const roomId = roomGroup.userData.room_id;
  console.log('[SELECT] Room selected:', roomId);
  
  // Update context bar
  updateContextBar(roomId);
  
  // Display room information
  displayRoomInfo(roomId);
  
  // Show panel
  showPanel();
  
  // Update map coordinates display
  updateMapCoordinates(roomGroup.position);
}

// ============================================================================
// UI MANAGEMENT
// ============================================================================

/**
 * Update loading status text
 */
function updateLoadingStatus(status) {
  const statusEl = document.getElementById('loading-status');
  if (statusEl) {
    statusEl.textContent = status;
  }
}

/**
 * Update loading progress bar
 */
function updateLoadingProgress(percent) {
  const progressEl = document.getElementById('loading-progress');
  if (progressEl) {
    progressEl.style.width = `${percent}%`;
  }
}

/**
 * Hide loading overlay
 */
function hideLoadingOverlay() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.5s ease';
    setTimeout(() => {
      overlay.classList.add('hidden');
    }, 500);
  }
}

/**
 * Show error modal
 */
function showError(message) {
  const modal = document.getElementById('error-modal');
  const messageEl = document.getElementById('error-message');
  
  if (modal && messageEl) {
    messageEl.textContent = message;
    modal.classList.remove('hidden');
  }
}

/**
 * Hide error modal
 */
function hideError() {
  const modal = document.getElementById('error-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

/**
 * Update top context bar with selected room info
 */
function updateContextBar(roomId) {
  const titleEl = document.getElementById('context-title');
  const guidanceEl = document.getElementById('context-guidance');
  
  if (titleEl) {
    titleEl.textContent = `FOCUS: ROOM ${roomId}`;
  }
  if (guidanceEl) {
    guidanceEl.textContent = 'VIEWING ROOM DETAILS';
  }
}

/**
 * Update map coordinates display
 */
function updateMapCoordinates(position) {
  const coordXEl = document.getElementById('map-coord-x');
  const coordYEl = document.getElementById('map-coord-y');
  const zoomEl = document.getElementById('map-zoom');
  
  if (coordXEl) coordXEl.textContent = position.x.toFixed(1);
  if (coordYEl) coordYEl.textContent = position.z.toFixed(1);
  if (zoomEl) zoomEl.textContent = state.camera.zoom.toFixed(2);
}

/**
 * Show room information panel
 */
function showPanel() {
  if (state.isMobile) {
    const bottomSheet = document.getElementById('bottom-sheet');
    if (bottomSheet) {
      bottomSheet.classList.remove('bottom-sheet-hidden');
      bottomSheet.classList.add('bottom-sheet-visible');
    }
  } else {
    const sidebar = document.getElementById('sidebar-panel');
    if (sidebar) {
      sidebar.classList.remove('panel-slide-out');
      sidebar.classList.add('panel-slide-in');
    }
  }
}

/**
 * Hide room information panel
 */
function hidePanel() {
  if (state.isMobile) {
    const bottomSheet = document.getElementById('bottom-sheet');
    if (bottomSheet) {
      bottomSheet.classList.remove('bottom-sheet-visible');
      bottomSheet.classList.add('bottom-sheet-hidden');
    }
  } else {
    const sidebar = document.getElementById('sidebar-panel');
    if (sidebar) {
      sidebar.classList.remove('panel-slide-in');
      sidebar.classList.add('panel-slide-out');
    }
  }
  
  // Deselect room
  if (state.selectedRoom) {
    state.selectedRoom.mesh.material.opacity = CONFIG.HOLOGRAM_OPACITY;
    state.selectedRoom.wireframe.material.color.setHex(COLORS.CYBER_CYAN);
    state.selectedRoom = null;
  }
  
  // Reset context bar
  resetContextBar();
}

/**
 * Reset context bar to default state
 */
function resetContextBar() {
  const titleEl = document.getElementById('context-title');
  const guidanceEl = document.getElementById('context-guidance');
  
  if (titleEl) {
    titleEl.textContent = 'FOCUS: VGU CAMPUS OVERVIEW';
  }
  if (guidanceEl) {
    guidanceEl.textContent = 'CLICK A ROOM TO VIEW DETAILS';
  }
}

/**
 * Find room info in info_data.json by room number
 */
function findRoomInfo(roomNumber) {
  if (!state.infoData || !state.infoData.data) return null;
  
  // Try exact match first
  let roomInfo = state.infoData.data.find(
    room => room.room_number === roomNumber
  );
  
  // If not found, try case-insensitive match
  if (!roomInfo) {
    roomInfo = state.infoData.data.find(
      room => room.room_number?.toLowerCase() === roomNumber.toLowerCase()
    );
  }
  
  // If still not found, try partial match
  if (!roomInfo) {
    roomInfo = state.infoData.data.find(
      room => room.room_number?.includes(roomNumber) || roomNumber.includes(room.room_number)
    );
  }
  
  return roomInfo;
}

/**
 * Display room information in the UI panel
 */
function displayRoomInfo(roomNumber) {
  const roomInfo = findRoomInfo(roomNumber);
  
  if (state.isMobile) {
    renderMobileRoomInfo(roomNumber, roomInfo);
  } else {
    renderDesktopRoomInfo(roomNumber, roomInfo);
  }
}

/**
 * Render room info for desktop sidebar
 */
function renderDesktopRoomInfo(roomNumber, roomInfo) {
  const container = document.getElementById('room-info');
  if (!container) return;
  
  if (!roomInfo) {
    container.innerHTML = `
      <div class="text-center py-8">
        <h3 class="text-xl font-bold text-vgu-orange mb-2">ROOM ${roomNumber}</h3>
        <p class="text-cyber-cyan font-mono text-sm">No detailed information available</p>
        <p class="text-white/60 text-sm mt-2">This room exists in the map geometry but has no recorded data.</p>
      </div>
    `;
    return;
  }
  
  const {
    heading_1,
    heading_2,
    department,
    fm_room_function,
    fm_room_type,
    area,
    unbounded_height,
    capacity,
    status,
    occupant_display
  } = roomInfo;
  
  container.innerHTML = `
    <div class="space-y-4">
      <div class="border-b border-cyber-cyan/30 pb-4">
        <h3 class="text-2xl font-bold text-vgu-orange">ROOM ${roomNumber}</h3>
        <p class="text-cyber-cyan font-mono text-sm">${heading_1 || 'N/A'}</p>
        <p class="text-white/60 text-sm">${heading_2 || ''}</p>
      </div>
      
      <div class="grid grid-cols-2 gap-3">
        ${department && department !== '___' ? `
          <div class="holo-panel rounded p-3">
            <p class="text-xs text-white/60 mb-1">DEPARTMENT</p>
            <p class="text-white font-semibold">${department}</p>
          </div>
        ` : ''}
        
        ${fm_room_function && fm_room_function !== '___' ? `
          <div class="holo-panel rounded p-3">
            <p class="text-xs text-white/60 mb-1">FUNCTION</p>
            <p class="text-white font-semibold">${fm_room_function}</p>
          </div>
        ` : ''}
        
        ${area ? `
          <div class="holo-panel rounded p-3">
            <p class="text-xs text-white/60 mb-1">AREA</p>
            <p class="text-white font-semibold">${area} m²</p>
          </div>
        ` : ''}
        
        ${unbounded_height ? `
          <div class="holo-panel rounded p-3">
            <p class="text-xs text-white/60 mb-1">HEIGHT</p>
            <p class="text-white font-semibold">${parseInt(unbounded_height) / 1000} m</p>
          </div>
        ` : ''}
        
        ${capacity && capacity !== '--' ? `
          <div class="holo-panel rounded p-3">
            <p class="text-xs text-white/60 mb-1">CAPACITY</p>
            <p class="text-white font-semibold">${capacity}</p>
          </div>
        ` : ''}
        
        <div class="holo-panel rounded p-3">
          <p class="text-xs text-white/60 mb-1">STATUS</p>
          <p class="text-vgu-orange font-semibold">${status || 'Unknown'}</p>
        </div>
      </div>
      
      ${occupant_display ? `
        <div class="holo-panel rounded p-4">
          <p class="text-xs text-white/60 mb-2">OCCUPANTS</p>
          <p class="text-white">${occupant_display}</p>
        </div>
      ` : ''}
      
      ${fm_room_type && fm_room_type !== '___' ? `
        <div class="holo-panel rounded p-4">
          <p class="text-xs text-white/60 mb-2">ROOM TYPE</p>
          <p class="text-cyber-cyan font-mono text-sm">${fm_room_type}</p>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Render room info for mobile bottom sheet
 */
function renderMobileRoomInfo(roomNumber, roomInfo) {
  const titleEl = document.getElementById('mobile-room-title');
  const container = document.getElementById('mobile-room-info');
  
  if (titleEl) {
    titleEl.textContent = `ROOM ${roomNumber}`;
  }
  
  if (!container) return;
  
  if (!roomInfo) {
    container.innerHTML = `
      <p class="text-cyber-cyan font-mono text-sm text-center">No detailed information available</p>
    `;
    return;
  }
  
  const {
    heading_1,
    heading_2,
    department,
    area,
    status
  } = roomInfo;
  
  container.innerHTML = `
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-white/60 text-sm">FUNCTION</span>
        <span class="text-cyber-cyan font-mono text-sm">${heading_1 || 'N/A'}</span>
      </div>
      
      ${department && department !== '___' ? `
        <div class="flex items-center justify-between">
          <span class="text-white/60 text-sm">DEPARTMENT</span>
          <span class="text-white text-sm">${department}</span>
        </div>
      ` : ''}
      
      ${area ? `
        <div class="flex items-center justify-between">
          <span class="text-white/60 text-sm">AREA</span>
          <span class="text-white text-sm">${area} m²</span>
        </div>
      ` : ''}
      
      <div class="flex items-center justify-between">
        <span class="text-white/60 text-sm">STATUS</span>
        <span class="text-vgu-orange text-sm">${status || 'Unknown'}</span>
      </div>
    </div>
  `;
}

// ============================================================================
// ANIMATION LOOP
// ============================================================================

/**
 * Main animation loop
 */
function animate() {
  requestAnimationFrame(animate);
  
  // Update controls
  state.controls.update();
  
  // Update map coordinates display periodically
  if (state.camera) {
    const zoomEl = document.getElementById('map-zoom');
    if (zoomEl) {
      zoomEl.textContent = state.camera.zoom.toFixed(2);
    }
  }
  
  // Render scene
  state.renderer.render(state.scene, state.camera);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Main initialization function
 */
async function init() {
  console.log('[VGU MAP] Initializing Digital Twin Facility Inspection System...');
  
  // Setup retry button
  const retryBtn = document.getElementById('retry-btn');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      hideError();
      init();
    });
  }
  
  // Setup close buttons
  const closeSidebar = document.getElementById('close-sidebar');
  if (closeSidebar) {
    closeSidebar.addEventListener('click', hidePanel);
  }
  
  const closeBottomSheet = document.getElementById('close-bottom-sheet');
  if (closeBottomSheet) {
    closeBottomSheet.addEventListener('click', hidePanel);
  }
  
  // Load data
  const dataLoaded = await initializeData();
  
  if (!dataLoaded) {
    return;
  }
  
  // Initialize Three.js
  initThreeJS();
  
  // Build map geometry
  updateLoadingStatus('Building 3D map...');
  buildMap();
  
  // Hide loading overlay after a short delay
  setTimeout(() => {
    hideLoadingOverlay();
    console.log('[VGU MAP] System initialized successfully');
  }, 500);
}

// Start the application
init();
