/**
 * VGU Map - Holographic 3D Campus Viewer
 * Vanilla JavaScript Implementation with Three.js
 * 
 * This module implements a complete Digital Twin facility inspection system
 * using Three.js for 3D rendering, with proper coordinate normalization
 * for Cartesian (meter-based) map data.
 */

// ═══════════════════════════════════════════════════════════════
// IMPORTS (Three.js via CDN importmap)
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION & CONSTANTS
// ═══════════════════════════════════════════════════════════════
const CONFIG = {
  colors: {
    vguOrange: 0xF37021,
    cyberCyan: 0x06B6D4,
    vguBlue: 0x0F1E36,
    dark: 0x070A12
  },
  camera: {
    zoom: 1.5,
    near: 0.1,
    far: 10000
  },
  room: {
    extrudeHeight: 50,
    hoverScale: 1.02
  }
};

// ═══════════════════════════════════════════════════════════════
// APPLICATION STATE
// ═══════════════════════════════════════════════════════════════
const state = {
  // Three.js components
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  raycaster: null,
  mouse: new THREE.Vector2(),
  
  // Data stores
  mapData: [],
  infoData: {},
  roomsMap: new Map(), // room_number -> room info
  
  // 3D objects
  roomMeshes: [],
  hoveredMesh: null,
  selectedMesh: null,
  
  // Normalization data
  boundingBox: {
    minX: Infinity, maxX: -Infinity,
    minY: Infinity, maxY: -Infinity,
    minZ: Infinity, maxZ: -Infinity
  },
  
  // UI state
  isLoading: true,
  loadingProgress: 0
};

// ═══════════════════════════════════════════════════════════════
// COORDINATE NORMALIZATION
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate the bounding box of all coordinates in map_data.json
 * This is essential for normalizing Cartesian (meter-based) coordinates
 * to fit within the Three.js scene centered at (0, 0, 0)
 */
function calculateBoundingBox(mapData) {
  const bbox = {
    minX: Infinity, maxX: -Infinity,
    minY: Infinity, maxY: -Infinity
  };
  
  mapData.forEach(segment => {
    const { StartX, StartY, EndX, EndY } = segment;
    
    bbox.minX = Math.min(bbox.minX, StartX, EndX);
    bbox.maxX = Math.max(bbox.maxX, StartX, EndX);
    bbox.minY = Math.min(bbox.minY, StartY, EndY);
    bbox.maxY = Math.max(bbox.maxY, StartY, EndY);
  });
  
  return bbox;
}

/**
 * Normalize coordinates to center them at (0, 0, 0) and scale appropriately
 * 
 * The map_data.json uses Cartesian coordinates in meters (likely from a CAD system).
 * These coordinates can be very large (e.g., 276797.41), so we need to:
 * 1. Calculate the center point of all coordinates
 * 2. Translate all points so the center is at (0, 0, 0)
 * 3. Optionally scale to fit a reasonable view frustum
 * 
 * @param {number} x - Original X coordinate
 * @param {number} y - Original Y coordinate
 * @param {object} bbox - Bounding box data
 * @returns {object} Normalized {x, y} coordinates
 */
function normalizeCoordinates(x, y, bbox) {
  // Calculate center of bounding box
  const centerX = (bbox.minX + bbox.maxX) / 2;
  const centerY = (bbox.minY + bbox.maxY) / 2;
  
  // Calculate dimensions
  const width = bbox.maxX - bbox.minX;
  const height = bbox.maxY - bbox.minY;
  
  // Scale factor to normalize to a reasonable size (e.g., 1000 units)
  const maxDim = Math.max(width, height);
  const scaleFactor = maxDim > 0 ? 1000 / maxDim : 1;
  
  // Translate to center and scale
  const normalizedX = (x - centerX) * scaleFactor;
  const normalizedY = (y - centerY) * scaleFactor;
  
  return { x: normalizedX, y: normalizedY, scaleFactor };
}

// ═══════════════════════════════════════════════════════════════
// DATA LOADING & PROCESSING
// ═══════════════════════════════════════════════════════════════

/**
 * Load JSON data from files
 */
async function loadJSON(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`[DATA] Failed to load ${url}:`, error);
    throw error;
  }
}

/**
 * Process map_data.json and build room polygons
 * Groups line segments by Room_Number and Loop_Index to form closed polygons
 */
function processMapData(mapData, bbox) {
  const rooms = new Map(); // room_number -> { loops: [[points]], userData: {} }
  
  mapData.forEach((segment, index) => {
    const roomNumber = segment.Room_Number;
    const loopIndex = segment.Loop_Index || 0;
    
    if (!rooms.has(roomNumber)) {
      rooms.set(roomNumber, { loops: [], userData: { room_id: roomNumber } });
    }
    
    const room = rooms.get(roomNumber);
    
    // Ensure loop array exists
    while (room.loops.length <= loopIndex) {
      room.loops.push([]);
    }
    
    // Add start point of segment
    const startNorm = normalizeCoordinates(segment.StartX, segment.StartY, bbox);
    room.loops[loopIndex].push(new THREE.Vector3(startNorm.x, 0, -startNorm.y)); // Negate Y for Z
    
    // Add end point only if it's the last segment or a different segment
    const isLastSegment = index === mapData.length - 1;
    const nextSegment = mapData[index + 1];
    const isNewRoomOrLoop = !nextSegment || 
                            nextSegment.Room_Number !== roomNumber || 
                            nextSegment.Loop_Index !== loopIndex;
    
    if (isLastSegment || isNewRoomOrLoop) {
      const endNorm = normalizeCoordinates(segment.EndX, segment.EndY, bbox);
      room.loops[loopIndex].push(new THREE.Vector3(endNorm.x, 0, -endNorm.y));
    }
  });
  
  return rooms;
}

/**
 * Build info data lookup map for quick access by room number
 */
function buildInfoLookup(infoData) {
  const lookup = new Map();
  
  if (infoData.data && Array.isArray(infoData.data)) {
    infoData.data.forEach(room => {
      // Normalize room number for matching (handle variations like "1.LB1" vs "LB1")
      const roomNumber = room.room_number?.toString().trim();
      if (roomNumber) {
        lookup.set(roomNumber, room);
      }
    });
  }
  
  return lookup;
}

// ═══════════════════════════════════════════════════════════════
// THREE.JS SCENE SETUP
// ═══════════════════════════════════════════════════════════════

/**
 * Initialize the Three.js scene, camera, renderer, and controls
 */
function initThreeJS() {
  const canvas = document.getElementById('three-canvas');
  const container = document.getElementById('map-container');
  
  // Scene
  state.scene = new THREE.Scene();
  state.scene.background = new THREE.Color(CONFIG.colors.dark);
  state.scene.fog = new THREE.FogExp2(CONFIG.colors.dark, 0.0005);
  
  // Orthographic Camera for top-down architectural view
  const aspect = container.clientWidth / container.clientHeight;
  const frustumSize = 1500;
  state.camera = new THREE.OrthographicCamera(
    -frustumSize * aspect / 2,
    frustumSize * aspect / 2,
    frustumSize / 2,
    -frustumSize / 2,
    CONFIG.camera.near,
    CONFIG.camera.far
  );
  state.camera.position.set(0, 1000, 0); // Top-down view
  state.camera.lookAt(0, 0, 0);
  
  // Renderer
  state.renderer = new THREE.WebGLRenderer({ 
    canvas, 
    antialias: true,
    alpha: false
  });
  state.renderer.setSize(container.clientWidth, container.clientHeight);
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  state.renderer.setClearColor(CONFIG.colors.dark, 1);
  
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
  state.controls.minZoom = 0.1;
  state.controls.maxZoom = 10;
  
  // Raycaster for interaction
  state.raycaster = new THREE.Raycaster();
  state.mouse = new THREE.Vector2();
  
  // Grid Helper (for reference)
  const gridHelper = new THREE.GridHelper(2000, 50, CONFIG.colors.cyberCyan, CONFIG.colors.vguBlue);
  gridHelper.position.y = -1;
  state.scene.add(gridHelper);
  
  // Ambient Light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  state.scene.add(ambientLight);
  
  // Directional Light
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(500, 500, 500);
  state.scene.add(directionalLight);
  
  // Handle resize
  window.addEventListener('resize', onWindowResize);
  
  return { canvas, container };
}

/**
 * Handle window resize events
 */
function onWindowResize() {
  const container = document.getElementById('map-container');
  const aspect = container.clientWidth / container.clientHeight;
  const frustumSize = 1500;
  
  state.camera.left = -frustumSize * aspect / 2;
  state.camera.right = frustumSize * aspect / 2;
  state.camera.top = frustumSize / 2;
  state.camera.bottom = -frustumSize / 2;
  state.camera.updateProjectionMatrix();
  
  state.renderer.setSize(container.clientWidth, container.clientHeight);
}

// ═══════════════════════════════════════════════════════════════
// ROOM MESH CREATION
// ═══════════════════════════════════════════════════════════════

/**
 * Create 3D mesh for a room using ExtrudeGeometry
 * Applies hologram/TRON aesthetic with wireframe and emissive materials
 */
function createRoomMesh(roomData, roomNumber) {
  const meshes = [];
  
  roomData.loops.forEach((loopPoints, loopIndex) => {
    if (loopPoints.length < 3) return; // Need at least 3 points for a polygon
    
    // Create shape from loop points
    const shape = new THREE.Shape();
    const firstPoint = loopPoints[0];
    shape.moveTo(firstPoint.x, firstPoint.z); // X and Z (Y was mapped to Z)
    
    for (let i = 1; i < loopPoints.length; i++) {
      const point = loopPoints[i];
      shape.lineTo(point.x, point.z);
    }
    
    // Close the shape
    shape.closePath();
    
    // Extrude settings for room volume
    const extrudeSettings = {
      depth: CONFIG.room.extrudeHeight,
      bevelEnabled: false,
      steps: 1
    };
    
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    
    // Center the geometry vertically
    geometry.translate(0, -CONFIG.room.extrudeHeight / 2, 0);
    
    // Hologram material - VGU Orange with emissive glow
    const material = new THREE.MeshStandardMaterial({
      color: CONFIG.colors.vguOrange,
      emissive: CONFIG.colors.vguOrange,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      wireframe: false
    });
    
    // Wireframe overlay for TRON effect
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: CONFIG.colors.cyberCyan,
      wireframe: true,
      transparent: true,
      opacity: 0.3
    });
    
    // Create main mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData = { 
      room_id: roomNumber,
      isRoom: true,
      originalScale: 1
    };
    
    // Create wireframe overlay
    const wireframeMesh = new THREE.Mesh(geometry, wireframeMaterial);
    wireframeMesh.position.copy(mesh.position);
    wireframeMesh.rotation.copy(mesh.rotation);
    wireframeMesh.scale.copy(mesh.scale);
    
    // Group both meshes
    const group = new THREE.Group();
    group.add(mesh);
    group.add(wireframeMesh);
    group.userData = { 
      room_id: roomNumber,
      isRoom: true,
      mainMesh: mesh,
      wireframeMesh: wireframeMesh
    };
    
    meshes.push(group);
  });
  
  return meshes;
}

/**
 * Render all rooms from processed map data
 */
function renderRooms(rooms) {
  rooms.forEach((roomData, roomNumber) => {
    const meshes = createRoomMesh(roomData, roomNumber);
    
    meshes.forEach(mesh => {
      state.scene.add(mesh);
      state.roomMeshes.push(mesh);
    });
  });
  
  console.log(`[3D] Rendered ${state.roomMeshes.length} room meshes`);
}

// ═══════════════════════════════════════════════════════════════
// INTERACTION HANDLING
// ═══════════════════════════════════════════════════════════════

/**
 * Handle mouse move for hover effects
 */
function onMouseMove(event) {
  const canvas = state.renderer.domElement;
  const rect = canvas.getBoundingClientRect();
  
  // Calculate normalized device coordinates (-1 to +1)
  state.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  state.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
  // Update raycaster
  state.raycaster.setFromCamera(state.mouse, state.camera);
  
  // Get intersections with room meshes
  const intersects = state.raycaster.intersectObjects(state.roomMeshes, true);
  
  if (intersects.length > 0) {
    // Find the root group (our custom userData structure)
    let targetObject = intersects[0].object;
    while (targetObject.parent && !targetObject.userData.isRoom) {
      targetObject = targetObject.parent;
    }
    
    if (targetObject.userData.isRoom && targetObject !== state.hoveredMesh) {
      // Reset previous hover
      if (state.hoveredMesh) {
        resetMeshScale(state.hoveredMesh);
      }
      
      // Set new hover
      state.hoveredMesh = targetObject;
      highlightMesh(targetObject, true);
      
      document.body.style.cursor = 'pointer';
    }
  } else {
    // Reset hover
    if (state.hoveredMesh && state.hoveredMesh !== state.selectedMesh) {
      resetMeshScale(state.hoveredMesh);
      highlightMesh(state.hoveredMesh, false);
    }
    state.hoveredMesh = null;
    document.body.style.cursor = 'default';
  }
}

/**
 * Handle click for room selection
 */
function onClick(event) {
  const canvas = state.renderer.domElement;
  const rect = canvas.getBoundingClientRect();
  
  // Calculate normalized device coordinates
  state.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  state.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
  // Update raycaster
  state.raycaster.setFromCamera(state.mouse, state.camera);
  
  // Get intersections
  const intersects = state.raycaster.intersectObjects(state.roomMeshes, true);
  
  if (intersects.length > 0) {
    // Find the root group
    let targetObject = intersects[0].object;
    while (targetObject.parent && !targetObject.userData.isRoom) {
      targetObject = targetObject.parent;
    }
    
    if (targetObject.userData.isRoom) {
      const roomId = targetObject.userData.room_id;
      selectRoom(roomId, targetObject);
    }
  }
}

/**
 * Highlight mesh on hover
 */
function highlightMesh(mesh, isHovered) {
  if (!mesh || !mesh.userData.mainMesh) return;
  
  const mainMat = mesh.userData.mainMesh.material;
  const wireMat = mesh.userData.wireframeMesh.material;
  
  if (isHovered) {
    mainMat.emissiveIntensity = 0.6;
    mainMat.opacity = 0.9;
    wireMat.opacity = 0.6;
    wireMat.color.setHex(CONFIG.colors.vguOrange);
  } else {
    mainMat.emissiveIntensity = 0.3;
    mainMat.opacity = 0.7;
    wireMat.opacity = 0.3;
    wireMat.color.setHex(CONFIG.colors.cyberCyan);
  }
}

/**
 * Scale mesh for visual feedback
 */
function scaleMesh(mesh, scale) {
  if (!mesh) return;
  mesh.scale.setScalar(scale);
}

function resetMeshScale(mesh) {
  scaleMesh(mesh, 1);
}

/**
 * Select a room and show its details
 */
function selectRoom(roomId, mesh) {
  // Deselect previous
  if (state.selectedMesh && state.selectedMesh !== state.hoveredMesh) {
    highlightMesh(state.selectedMesh, false);
  }
  
  // Select new
  state.selectedMesh = mesh;
  highlightMesh(mesh, true);
  
  // Update HUD
  updateHUD(roomId);
  
  // Show info panel
  showInfoPanel(roomId);
}

// ═══════════════════════════════════════════════════════════════
// UI MANAGEMENT
// ═══════════════════════════════════════════════════════════════

/**
 * Update the top HUD bar with current focus
 */
function updateHUD(roomId) {
  const titleEl = document.getElementById('hud-context-title');
  if (titleEl) {
    titleEl.textContent = `FOCUS: ${roomId}`;
  }
}

/**
 * Show info panel with room details
 */
function showInfoPanel(roomId) {
  const panel = document.getElementById('info-panel');
  const titleEl = document.getElementById('panel-room-title');
  const contentEl = document.getElementById('panel-content');
  
  // Get room info from lookup
  const roomInfo = state.roomsMap.get(roomId);
  
  // Update title
  if (titleEl) {
    titleEl.textContent = roomId;
  }
  
  // Generate content
  if (contentEl) {
    if (roomInfo) {
      contentEl.innerHTML = generateRoomInfoHTML(roomInfo);
    } else {
      contentEl.innerHTML = `
        <div class="text-center py-8">
          <p class="font-mono text-sm text-vgu-cyan mb-2">NO_DATA_AVAILABLE</p>
          <p class="text-xs text-white/50">Room information not found in database.</p>
        </div>
      `;
    }
  }
  
  // Show panel with animation
  if (panel) {
    panel.classList.add('visible');
  }
}

/**
 * Generate HTML for room information
 */
function generateRoomInfoHTML(roomInfo) {
  const statusClass = roomInfo.status && roomInfo.status !== 'Chưa cập nhật' 
    ? 'status-active' 
    : 'status-inactive';
  
  return `
    <div class="info-section">
      <div class="info-label">Status</div>
      <span class="status-badge ${statusClass}">${roomInfo.status || 'Unknown'}</span>
    </div>
    
    ${roomInfo.heading_1 ? `
    <div class="info-section">
      <div class="info-label">Room Type</div>
      <div class="info-value">${roomInfo.heading_1}</div>
    </div>
    ` : ''}
    
    ${roomInfo.heading_2 ? `
    <div class="info-section">
      <div class="info-label">Vietnamese Name</div>
      <div class="info-value">${roomInfo.heading_2}</div>
    </div>
    ` : ''}
    
    ${roomInfo.department && roomInfo.department !== '___' ? `
    <div class="info-section">
      <div class="info-label">Department</div>
      <div class="info-value">${roomInfo.department}</div>
    </div>
    ` : ''}
    
    ${roomInfo.fm_room_function && roomInfo.fm_room_function !== '___' ? `
    <div class="info-section">
      <div class="info-label">Function</div>
      <div class="info-value">${roomInfo.fm_room_function}</div>
    </div>
    ` : ''}
    
    ${roomInfo.area ? `
    <div class="info-section">
      <div class="info-label">Area</div>
      <div class="info-value">${roomInfo.area} m²</div>
    </div>
    ` : ''}
    
    ${roomInfo.unbounded_height ? `
    <div class="info-section">
      <div class="info-label">Ceiling Height</div>
      <div class="info-value">${parseInt(roomInfo.unbounded_height) / 1000} m</div>
    </div>
    ` : ''}
    
    ${roomInfo.capacity && roomInfo.capacity !== '--' ? `
    <div class="info-section">
      <div class="info-label">Capacity</div>
      <div class="info-value">${roomInfo.capacity} persons</div>
    </div>
    ` : ''}
    
    ${roomInfo.occupant_display ? `
    <div class="info-section">
      <div class="info-label">Occupants</div>
      <div class="info-value">${roomInfo.occupant_display}</div>
    </div>
    ` : ''}
  `;
}

/**
 * Hide info panel
 */
function hideInfoPanel() {
  const panel = document.getElementById('info-panel');
  if (panel) {
    panel.classList.remove('visible');
  }
  
  // Reset selection
  if (state.selectedMesh && state.selectedMesh !== state.hoveredMesh) {
    highlightMesh(state.selectedMesh, false);
  }
  state.selectedMesh = null;
  
  // Reset HUD
  const titleEl = document.getElementById('hud-context-title');
  if (titleEl) {
    titleEl.textContent = 'FOCUS: VGU CAMPUS OVERVIEW';
  }
}

/**
 * Update loading progress
 */
function updateLoadingProgress(progress) {
  state.loadingProgress = Math.min(100, Math.max(0, progress));
  
  const progressBar = document.getElementById('loading-progress');
  const percentValue = document.getElementById('loading-percent-value');
  
  if (progressBar) {
    progressBar.style.width = `${state.loadingProgress}%`;
  }
  if (percentValue) {
    percentValue.textContent = Math.round(state.loadingProgress);
  }
}

/**
 * Hide loading overlay
 */
function hideLoadingOverlay() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }
  state.isLoading = false;
}

// ═══════════════════════════════════════════════════════════════
// ANIMATION LOOP
// ═══════════════════════════════════════════════════════════════

/**
 * Main animation loop
 */
function animate() {
  requestAnimationFrame(animate);
  
  // Update controls
  state.controls.update();
  
  // Render scene
  state.renderer.render(state.scene, state.camera);
}

// ═══════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════

/**
 * Main initialization function
 */
async function init() {
  console.log('[VGU Map] Initializing Holographic Map System...');
  
  try {
    // Step 1: Initialize Three.js
    console.log('[INIT] Setting up Three.js scene...');
    initThreeJS();
    updateLoadingProgress(10);
    
    // Step 2: Load data
    console.log('[INIT] Loading map and info data...');
    const [mapData, infoData] = await Promise.all([
      loadJSON('map_data.json'),
      loadJSON('info_data.json')
    ]);
    
    state.mapData = mapData;
    state.infoData = infoData;
    updateLoadingProgress(40);
    
    // Step 3: Calculate bounding box for normalization
    console.log('[INIT] Calculating coordinate bounding box...');
    state.boundingBox = calculateBoundingBox(mapData);
    console.log('[DATA] Bounding Box:', state.boundingBox);
    updateLoadingProgress(50);
    
    // Step 4: Process map data into room polygons
    console.log('[INIT] Processing map data into room polygons...');
    const rooms = processMapData(mapData, state.boundingBox);
    state.roomsMap = buildInfoLookup(infoData);
    updateLoadingProgress(60);
    
    // Step 5: Render rooms
    console.log('[INIT] Rendering 3D room meshes...');
    renderRooms(rooms);
    updateLoadingProgress(80);
    
    // Step 6: Setup event listeners
    console.log('[INIT] Setting up interaction handlers...');
    state.renderer.domElement.addEventListener('mousemove', onMouseMove);
    state.renderer.domElement.addEventListener('click', onClick);
    
    // Panel close button
    const closeBtn = document.getElementById('close-panel-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', hideInfoPanel);
    }
    
    updateLoadingProgress(90);
    
    // Step 7: Start animation loop
    console.log('[INIT] Starting animation loop...');
    animate();
    
    // Step 8: Hide loading overlay
    setTimeout(() => {
      updateLoadingProgress(100);
      setTimeout(hideLoadingOverlay, 500);
    }, 300);
    
    console.log('[VGU Map] Initialization complete!');
    
  } catch (error) {
    console.error('[INIT] Fatal error during initialization:', error);
    
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.innerHTML = `
        <div class="text-center">
          <div class="text-4xl mb-4">⚠️</div>
          <p class="font-mono text-sm text-vgu-orange mb-2">INITIALIZATION_ERROR</p>
          <p class="text-xs text-white/50">${error.message}</p>
          <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-vgu-orange/20 border border-vgu-orange text-vgu-orange rounded text-xs font-mono hover:bg-vgu-orange/30">
            RETRY_LOAD
          </button>
        </div>
      `;
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// START APPLICATION
// ═══════════════════════════════════════════════════════════════

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
