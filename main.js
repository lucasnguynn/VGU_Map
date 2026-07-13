/**
 * VGU Map - Holographic 3D Campus Viewer
 * Vanilla JavaScript Implementation
 * 
 * This module initializes the 3D Hologram Map, parses JSON data,
 * and handles UI events natively without any framework.
 */

// ═══════════════════════════════════════════════════════════════
// IMPORTS (Three.js via CDN importmap)
// ═══════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ═══════════════════════════════════════════════════════════════
// GLOBAL STATE
// ═══════════════════════════════════════════════════════════════
const state = {
  // Map state
  map: null,
  mapLoaded: false,
  selectedBuilding: null,
  selectedFloor: null,
  selectedRoomId: null,
  zoomLevel: 17.5,
  pitchLevel: 45,
  mapCenter: [106.6155, 11.1083],
  
  // Data stores
  floorsConfig: {},
  labs: [],
  infoData: [],
  currentFloorGeojson: null,
  
  // Markers
  clusterMarkers: [],
  roomMarkers: [],
  
  // 3D Viewer state
  viewer: {
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    currentModel: null,
    gridHelper: null,
    scanLine: null,
    scanDirection: 1,
    scanYMin: -1,
    scanYMax: 1,
    animationFrameId: null,
    resizeObserver: null,
    loading: true,
    loadingProgress: 0,
    error: null,
    meshCount: 0,
    renderMode: 'hologram',
    autoRotate: true,
    showHud: window.innerWidth > 768 && window.innerHeight > 500
  }
};

// Building centers for camera fly-to
const buildingCenters = {
  'cluster-1': [106.6150547, 11.1086567],
  'cluster-2': [106.6152379, 11.1081542],
  'cluster-3': [106.6154201, 11.1077056],
  'cluster-5': [106.6160420, 11.1088469],
  'cluster-6': [106.6162763, 11.1081780]
};

// Cluster labels data
const clustersData = [
  { id: 'cluster-1', label: 'Cluster 1', name: 'Materials Science / Physics', coords: [106.6150547, 11.1086567] },
  { id: 'cluster-2', label: 'Cluster 2', name: 'Electrical Engineering / IT / CS', coords: [106.6152379, 11.1081542] },
  { id: 'cluster-3', label: 'Cluster 3', name: 'Mechanical Eng. / Mechatronics', coords: [106.6154201, 11.1077056] },
  { id: 'cluster-5', label: 'Cluster 5', name: 'Chemical & Civil Engineering', coords: [106.6160420, 11.1088469] },
  { id: 'cluster-6', label: 'Cluster 6', name: 'Business / Finance', coords: [106.6162763, 11.1081780] }
];

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate polygon centroid from GeoJSON coordinates
 */
function getPolygonCentroid(coordinates) {
  if (!coordinates || coordinates.length === 0) return [0, 0];
  
  const ring = coordinates[0];
  let x = 0, y = 0;
  
  for (let i = 0; i < ring.length; i++) {
    x += ring[i][0];
    y += ring[i][1];
  }
  
  return [x / ring.length, y / ring.length];
}

/**
 * Get department color mapping
 */
function getDepartmentColor(department) {
  const colorMap = {
    'Materials Science': '#EF5A24',
    'Chemical Engineering': '#06B6D4',
    'Applied Physics': '#8B5CF6',
    'Chemistry': '#EC4899',
    'Electrical Engineering': '#3B82F6',
    'Computer Science': '#10B981',
    'Mechanical Engineering': '#34D399',
    'Mechatronics': '#14B8A6',
    'Civil Engineering': '#6B7280',
    'Finance': '#F59E0B',
    'Business Administration': '#F59E0B',
    'General Education': '#4B5563'
  };
  
  for (const [key, color] of Object.entries(colorMap)) {
    if (department && department.includes(key)) {
      return color;
    }
  }
  return '#1E293B';
}

/**
 * Update HUD context title based on selection
 */
function updateHudContext() {
  const titleEl = document.getElementById('hud-context-title');
  const guidanceEl = document.getElementById('hud-context-guidance');
  
  if (!state.selectedBuilding) {
    titleEl.textContent = 'FOCUS: VGU CAMPUS OVERVIEW';
    guidanceEl.textContent = 'CLICK A CLUSTER TO ENTER INTERNAL LAB CELLS';
    return;
  }
  
  const nameMap = {
    'cluster-1': 'Academic Cluster 1',
    'cluster-2': 'Academic Cluster 2',
    'cluster-3': 'Academic Cluster 3',
    'cluster-5': 'Academic Cluster 5',
    'cluster-6': 'Academic Cluster 6'
  };
  
  const buildingName = nameMap[state.selectedBuilding] || state.selectedBuilding.replace('-', ' ').toUpperCase();
  
  if (state.selectedFloor) {
    titleEl.textContent = `FOCUS: ${buildingName} // FLOOR ${state.selectedFloor}`;
  } else {
    titleEl.textContent = `FOCUS: ${buildingName}`;
  }
  
  guidanceEl.textContent = 'USE ELEVATOR HUD ON THE LEFT TO CHANGE LEVELS';
}

/**
 * Get floors with labs for current building
 */
function getFloorsWithLabs(buildingId) {
  if (!buildingId || !state.labs) return new Set();
  const matching = state.labs.filter(l => l.building_id === buildingId);
  return new Set(matching.map(l => l.floor));
}

// ═══════════════════════════════════════════════════════════════
// MAP INITIALIZATION (MapLibre GL)
// ═══════════════════════════════════════════════════════════════

async function initMap() {
  try {
    // Load floors config
    try {
      const res = await fetch('/floors-config.json');
      state.floorsConfig = await res.json();
    } catch (err) {
      console.error('Failed to load floors config', err);
    }
    
    // Load labs data from info_data.json
    try {
      const res = await fetch('/info_data.json');
      const data = await res.json();
      state.infoData = data.data || [];
      
      // Transform info_data into labs format for compatibility
      state.labs = state.infoData
        .filter(item => item.room_number && item.room_number.includes('.'))
        .map(item => {
          const parts = item.room_number.split('.');
          const floor = parseInt(parts[0]) || 1;
          const roomId = parts.slice(1).join('.');
          
          // Determine building from room prefix
          let buildingId = 'cluster-1'; // default
          if (roomId.startsWith('LB')) buildingId = 'cluster-1';
          else if (roomId.startsWith('CR')) buildingId = 'cluster-2';
          
          return {
            room_id: roomId,
            name: item.heading_2 || item.heading_1 || roomId,
            type: item.fm_room_type === 'laboratory' ? 'laboratory' : 'other',
            department: item.department || 'General',
            building_id: buildingId,
            floor: floor
          };
        });
    } catch (err) {
      console.error('Failed to load info_data.json', err);
    }
    
    // Initialize MapLibre map
    state.map = new maplibregl.Map({
      container: 'map-container',
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
              'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
              'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors, © CartoDB',
            maxzoom: 19
          }
        },
        layers: [{
          id: 'osm-raster',
          type: 'raster',
          source: 'osm-tiles',
          minzoom: 0,
          maxzoom: 22
        }]
      },
      center: state.mapCenter,
      zoom: state.zoomLevel,
      pitch: state.pitchLevel,
      bearing: -20
    });
    
    // Make map globally accessible for debugging
    window.map = state.map;
    
    // Listen to camera events for UI display
    state.map.on('zoom', () => {
      state.zoomLevel = state.map.getZoom();
      document.getElementById('map-zoom').textContent = state.zoomLevel.toFixed(1);
    });
    
    state.map.on('pitch', () => {
      state.pitchLevel = Math.round(state.map.getPitch());
      document.getElementById('map-pitch').textContent = state.pitchLevel;
    });
    
    state.map.on('move', () => {
      const center = state.map.getCenter();
      state.mapCenter = [center.lng, center.lat];
      document.getElementById('map-lat').textContent = center.lat.toFixed(4);
      document.getElementById('map-lon').textContent = center.lng.toFixed(4);
    });
    
    state.map.on('load', () => {
      state.mapLoaded = true;
      setupMapLayers();
      setupMapInteractions();
      renderClusterLabels();
    });
    
    // Resize observer for responsive map
    if ('ResizeObserver' in window) {
      const resizeObserver = new ResizeObserver(() => {
        if (state.map) {
          state.map.resize();
        }
      });
      const mapContainer = document.getElementById('map-container');
      if (mapContainer) {
        resizeObserver.observe(mapContainer);
      }
    }
    
  } catch (err) {
    console.error('Failed to initialize map:', err);
  }
}

/**
 * Setup MapLibre layers for buildings and rooms
 */
function setupMapLayers() {
  const map = state.map;
  
  // Add VGU Buildings Shell Data
  map.addSource('vgu-buildings', {
    type: 'geojson',
    data: '/campus-buildings.json'
  });
  
  // Add 3D building extrusions
  map.addLayer({
    id: 'vgu-buildings-extrusion',
    type: 'fill-extrusion',
    source: 'vgu-buildings',
    paint: {
      'fill-extrusion-color': '#0C2B5C',
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': ['get', 'base_height'],
      'fill-extrusion-opacity': 0.75
    }
  });
  
  // Glowing outline for buildings
  map.addLayer({
    id: 'vgu-buildings-outline',
    type: 'line',
    source: 'vgu-buildings',
    paint: {
      'line-color': '#EF5A24',
      'line-width': 1.5,
      'line-opacity': 0.6
    }
  });
  
  // Add 3D building extrusion for selected building
  map.addLayer({
    id: 'vgu-selected-building-extrusion',
    type: 'fill-extrusion',
    source: 'vgu-buildings',
    paint: {
      'fill-extrusion-color': '#0C2B5C',
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': ['get', 'base_height'],
      'fill-extrusion-opacity': 0.1
    },
    filter: ['==', ['get', 'building_id'], '']
  });
  
  // Glowing outline for selected building
  map.addLayer({
    id: 'vgu-selected-building-outline',
    type: 'line',
    source: 'vgu-buildings',
    paint: {
      'line-color': '#EF5A24',
      'line-width': 3.0,
      'line-opacity': 0.9
    },
    filter: ['==', ['get', 'building_id'], '']
  });
  
  // Add empty source for Floorplans
  map.addSource('vgu-floorplan', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: []
    }
  });
  
  // Add room fill layer
  map.addLayer({
    id: 'vgu-rooms-fill',
    type: 'fill',
    source: 'vgu-floorplan',
    paint: {
      'fill-color': ['#get', 'department'],
      'fill-opacity': 0.4
    },
    layout: {
      visibility: 'none'
    }
  });
  
  // Add room outline layer
  map.addLayer({
    id: 'vgu-rooms-outline',
    type: 'line',
    source: 'vgu-floorplan',
    paint: {
      'line-color': '#EF5A24',
      'line-width': 2,
      'line-opacity': 0.8
    },
    layout: {
      visibility: 'none'
    }
  });
}

/**
 * Setup map click/touch interactions
 */
function setupMapInteractions() {
  const map = state.map;
  
  // Building click handler
  map.on('click', 'vgu-buildings-extrusion', (e) => {
    if (!e.features || !e.features[0]) return;
    const bProps = e.features[0].properties;
    selectBuilding(bProps.building_id);
  });
  
  // Room click handler
  map.on('click', 'vgu-rooms-fill', (e) => {
    if (!e.features || !e.features[0]) return;
    const rProps = e.features[0].properties;
    selectRoom(rProps.room_id);
  });
  
  // Pointer feedback
  map.on('mouseenter', 'vgu-buildings-extrusion', () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'vgu-buildings-extrusion', () => {
    map.getCanvas().style.cursor = '';
  });
  
  map.on('mouseenter', 'vgu-rooms-fill', () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'vgu-rooms-fill', () => {
    map.getCanvas().style.cursor = '';
  });
}

// ═══════════════════════════════════════════════════════════════
// CLUSTER & ROOM MARKERS
// ═══════════════════════════════════════════════════════════════

function clearClusterMarkers() {
  state.clusterMarkers.forEach(m => m.remove());
  state.clusterMarkers = [];
}

function clearRoomMarkers() {
  state.roomMarkers.forEach(m => m.remove());
  state.roomMarkers = [];
}

function renderClusterLabels() {
  clearClusterMarkers();
  
  if (state.selectedBuilding) return; // Hide when building is selected
  
  clustersData.forEach(c => {
    const el = document.createElement('div');
    el.className = 'relative w-0 h-0 cursor-pointer pointer-events-auto';
    el.innerHTML = `
      <div class="cluster-marker-dot absolute -translate-x-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center pointer-events-auto">
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#EF5A24] opacity-75"></span>
        <span class="relative inline-flex rounded-full h-2 w-2 bg-[#EF5A24] shadow-[0_0_8px_#EF5A24]"></span>
      </div>
      <div class="cluster-marker-card absolute top-4 left-1/2 -translate-x-1/2 px-3.5 py-2 rounded bg-[#0F1E36]/95 border border-[#06B6D4]/30 hover:border-[#EF5A24] text-white shadow-xl backdrop-blur-md transition-all duration-300 hover:scale-105 text-center min-w-[140px] pointer-events-auto">
        <div class="cluster-title">${c.label}</div>
        <div class="cluster-subtitle">${c.name}</div>
        <div class="cluster-action">TAP TO ENTER →</div>
      </div>
    `;
    
    // Bind click handler
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      selectBuilding(c.id);
    });
    
    const marker = new maplibregl.Marker({ element: el })
      .setLngLat(c.coords)
      .addTo(state.map);
    
    state.clusterMarkers.push(marker);
  });
}

function renderRoomMarkers(floorGeojson) {
  clearRoomMarkers();
  
  if (!floorGeojson || !floorGeojson.features) return;
  
  floorGeojson.features.forEach(feature => {
    if (feature.geometry && feature.geometry.coordinates) {
      const centroid = getPolygonCentroid(feature.geometry.coordinates);
      const props = feature.properties;
      const roomName = props.name || props.room_id || 'Unknown Room';
      
      const el = document.createElement('div');
      el.className = 'room-marker-wrapper';
      el.innerHTML = `
        <div class="room-marker-card pointer-events-auto cursor-pointer">
          <div class="room-title">${props.room_id}</div>
          <div class="room-subtitle">${roomName}</div>
        </div>
      `;
      
      // Bind click handler
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        selectRoom(props.room_id);
      });
      
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(centroid)
        .addTo(state.map);
      
      state.roomMarkers.push(marker);
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// BUILDING & FLOOR SELECTION
// ═══════════════════════════════════════════════════════════════

function selectBuilding(buildingId) {
  state.selectedBuilding = buildingId;
  state.selectedFloor = null;
  state.selectedRoomId = null;
  
  // Clear cluster markers
  clearClusterMarkers();
  
  // Zoom into building
  const coords = buildingCenters[buildingId] || [106.6155, 11.1083];
  state.map.flyTo({
    center: coords,
    zoom: 19.5,
    pitch: 0,
    bearing: 0,
    duration: 1500
  });
  
  // Update building filters
  state.map.setFilter('vgu-buildings-extrusion', ['!=', ['get', 'building_id'], buildingId]);
  state.map.setFilter('vgu-buildings-outline', ['!=', ['get', 'building_id'], buildingId]);
  state.map.setFilter('vgu-selected-building-extrusion', ['==', ['get', 'building_id'], buildingId]);
  state.map.setFilter('vgu-selected-building-outline', ['==', ['get', 'building_id'], buildingId]);
  
  // Show elevator UI
  setupElevatorUI(buildingId);
  updateHudContext();
}

function setupElevatorUI(buildingId) {
  const elevatorUi = document.getElementById('elevator-ui');
  const floors = state.floorsConfig[buildingId] || [2, 1];
  const floorsWithLabs = getFloorsWithLabs(buildingId);
  
  // Generate floor buttons
  const panel = elevatorUi.querySelector('.elevator-panel');
  panel.innerHTML = '';
  
  floors.forEach(floorNum => {
    const btn = document.createElement('button');
    btn.className = 'floor-btn';
    btn.dataset.floor = floorNum;
    btn.textContent = `L${floorNum}`;
    
    if (floorsWithLabs.has(floorNum)) {
      btn.classList.add('has-lab');
    }
    
    btn.addEventListener('click', () => {
      selectFloor(floorNum);
    });
    
    panel.appendChild(btn);
  });
  
  // Add reset button
  const resetBtn = document.createElement('button');
  resetBtn.className = 'floor-btn reset-btn';
  resetBtn.textContent = '✕';
  resetBtn.title = 'Exit Building';
  resetBtn.addEventListener('click', resetMap);
  panel.appendChild(resetBtn);
  
  // Show elevator UI
  elevatorUi.classList.remove('hidden');
}

function selectFloor(floorNum) {
  state.selectedFloor = floorNum;
  
  // Update active button state
  document.querySelectorAll('.floor-btn').forEach(btn => {
    btn.classList.remove('active');
    if (parseInt(btn.dataset.floor) === floorNum) {
      btn.classList.add('active');
    }
  });
  
  // Load floorplan
  loadFloorplan(floorNum);
  updateHudContext();
}

function resetMap() {
  state.selectedBuilding = null;
  state.selectedFloor = null;
  state.selectedRoomId = null;
  
  // Zoom out to campus view
  state.map.flyTo({
    center: [106.6155, 11.1083],
    zoom: 17.5,
    pitch: 45,
    bearing: -20,
    duration: 1500
  });
  
  // Restore all building shells
  state.map.setFilter('vgu-buildings-extrusion', null);
  state.map.setFilter('vgu-buildings-outline', null);
  state.map.setFilter('vgu-selected-building-extrusion', ['==', ['get', 'building_id'], '']);
  state.map.setFilter('vgu-selected-building-outline', ['==', ['get', 'building_id'], '']);
  
  // Hide floorplan layers
  state.map.setLayoutProperty('vgu-rooms-fill', 'visibility', 'none');
  state.map.setLayoutProperty('vgu-rooms-outline', 'visibility', 'none');
  
  // Clear markers
  clearRoomMarkers();
  
  // Hide elevator UI
  document.getElementById('elevator-ui').classList.add('hidden');
  
  // Restore cluster labels
  renderClusterLabels();
  updateHudContext();
}

// ═══════════════════════════════════════════════════════════════
// FLOORPLAN LOADING
// ═══════════════════════════════════════════════════════════════

async function loadFloorplan(floorNum) {
  if (!state.map || !state.selectedBuilding) return;
  
  try {
    const filePath = `/msi-floor${floorNum}.json`;
    const res = await fetch(filePath);
    const geojson = await res.json();
    
    state.currentFloorGeojson = geojson;
    
    // Update floorplan source
    state.map.getSource('vgu-floorplan').setData(geojson);
    
    // Show room layers
    state.map.setLayoutProperty('vgu-rooms-fill', 'visibility', 'visible');
    state.map.setLayoutProperty('vgu-rooms-outline', 'visibility', 'visible');
    
    // Render room markers
    renderRoomMarkers(geojson);
    
    // If a room is already selected, zoom to it
    if (state.selectedRoomId) {
      setTimeout(() => {
        zoomToRoom(state.selectedRoomId);
      }, 300);
    }
    
  } catch (err) {
    console.error('Failed to load floorplan data', err);
  }
}

function zoomToRoom(roomId) {
  if (!state.map || !state.currentFloorGeojson || !roomId) return;
  
  const roomFeature = state.currentFloorGeojson.features.find(
    f => f.properties.room_id === roomId
  );
  
  if (roomFeature && roomFeature.geometry && roomFeature.geometry.coordinates) {
    const centroid = getPolygonCentroid(roomFeature.geometry.coordinates);
    state.map.flyTo({
      center: centroid,
      zoom: 20.8,
      pitch: 30,
      bearing: 10,
      duration: 1200
    });
  }
}

function selectRoom(roomId) {
  state.selectedRoomId = roomId;
  zoomToRoom(roomId);
  
  // Optionally open 3D model viewer if a model is available
  // For now, we'll just log it
  console.log('Selected room:', roomId);
}

// ═══════════════════════════════════════════════════════════════
// 3D HOLOGRAM VIEWER INITIALIZATION
// ═══════════════════════════════════════════════════════════════

/**
 * Initialize the 3D Hologram Viewer using Three.js
 * This is the core function that sets up the WebGL scene, camera,
 * renderer, and loads the 3D model with holographic effects.
 */
async function init3DViewer(modelSrc) {
  const viewer = state.viewer;
  const container = document.getElementById('viewer-container');
  const canvas = document.getElementById('viewer-canvas');
  
  try {
    const width = container.clientWidth || 300;
    const height = container.clientHeight || 300;
    
    // 1. Create Scene
    viewer.scene = new THREE.Scene();
    viewer.scene.background = new THREE.Color(0x070a12);
    viewer.scene.fog = new THREE.FogExp2(0x070a12, 0.04);
    
    // 2. Setup Camera
    viewer.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    viewer.camera.position.set(0, 0, 5);
    
    // 3. Setup Renderer
    viewer.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    viewer.renderer.setSize(width, height);
    viewer.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    viewer.renderer.shadowMap.enabled = true;
    viewer.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    viewer.renderer.toneMappingExposure = 1.0;
    
    // 4. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    viewer.scene.add(ambientLight);
    
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
    keyLight.position.set(5, 8, 5);
    viewer.scene.add(keyLight);
    
    const cyanLight = new THREE.PointLight(0x06b6d4, 1.5, 15);
    cyanLight.position.set(-4, 2, -4);
    viewer.scene.add(cyanLight);
    
    const orangeLight = new THREE.PointLight(0xef5a24, 1.8, 15);
    orangeLight.position.set(4, -2, 4);
    viewer.scene.add(orangeLight);
    
    // 5. Controls
    viewer.controls = new OrbitControls(viewer.camera, viewer.renderer.domElement);
    viewer.controls.enableDamping = true;
    viewer.controls.dampingFactor = 0.05;
    viewer.controls.maxPolarAngle = Math.PI / 2 + 0.1;
    viewer.controls.minDistance = 1;
    viewer.controls.maxDistance = 15;
    viewer.controls.autoRotate = viewer.autoRotate;
    viewer.controls.autoRotateSpeed = 1.2;
    
    // 6. Grid Helper (Floor matrix)
    viewer.gridHelper = new THREE.GridHelper(10, 24, 0xef5a24, 0x06b6d4);
    viewer.gridHelper.position.y = -1.2;
    viewer.gridHelper.material.transparent = true;
    viewer.gridHelper.material.opacity = viewer.renderMode === 'hologram' ? 0.6 : 0.15;
    viewer.scene.add(viewer.gridHelper);
    
    // 7. Load GLB Model
    const loader = new GLTFLoader();
    loader.load(
      modelSrc,
      (gltf) => {
        const model = gltf.scene;
        viewer.currentModel = model;
        
        // Center & Auto-scale model
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 2.0 / maxDim;
        model.scale.set(scale, scale, scale);
        
        model.position.x = -center.x * scale;
        model.position.y = -center.y * scale;
        model.position.z = -center.z * scale;
        
        viewer.scene.add(model);
        
        // Count meshes and cache materials
        let meshes = 0;
        model.traverse((child) => {
          if (child.isMesh) {
            meshes++;
            child.castShadow = true;
            child.receiveShadow = true;
            
            if (child.material) {
              child.material.roughness = Math.min(child.material.roughness, 0.6);
              child.material.metalness = Math.max(child.material.metalness, 0.4);
            }
          }
        });
        viewer.meshCount = meshes;
        document.getElementById('mesh-count').textContent = meshes;
        
        // Setup scanline bounds
        const scaleBox = new THREE.Box3().setFromObject(model);
        const scaleSize = scaleBox.getSize(new THREE.Vector3());
        const scaleCenter = scaleBox.getCenter(new THREE.Vector3());
        
        viewer.scanYMin = scaleCenter.y - scaleSize.y / 2;
        viewer.scanYMax = scaleCenter.y + scaleSize.y / 2;
        
        // Create horizontal ring scanner line
        const scanRingGeom = new THREE.CylinderGeometry(
          Math.max(scaleSize.x, scaleSize.z) * 0.7,
          Math.max(scaleSize.x, scaleSize.z) * 0.7,
          0.02,
          32,
          32,
          1,
          true
        );
        const scanRingMat = new THREE.MeshBasicMaterial({
          color: 0xef5a24,
          transparent: true,
          opacity: 0.8,
          side: THREE.DoubleSide
        });
        viewer.scanLine = new THREE.Mesh(scanRingGeom, scanRingMat);
        viewer.scanLine.position.y = scaleCenter.y;
        viewer.scanLine.visible = viewer.renderMode === 'hologram';
        viewer.scene.add(viewer.scanLine);
        
        // Apply starting render mode
        applyRenderMode(viewer.renderMode);
        
        // Hide loading, show viewer
        viewer.loading = false;
        document.getElementById('viewer-loading').classList.add('hidden');
        document.getElementById('viewer-hud').classList.remove('hidden');
        document.getElementById('viewer-controls').classList.remove('hidden');
        
        animate();
      },
      (xhr) => {
        if (xhr.total) {
          viewer.loadingProgress = Math.round((xhr.loaded / xhr.total) * 100);
          document.getElementById('loading-progress').style.width = `${viewer.loadingProgress}%`;
          document.getElementById('loading-percent-value').textContent = viewer.loadingProgress;
        } else {
          if (viewer.loadingProgress < 95) {
            viewer.loadingProgress += 5;
            document.getElementById('loading-progress').style.width = `${viewer.loadingProgress}%`;
            document.getElementById('loading-percent-value').textContent = viewer.loadingProgress;
          }
        }
      },
      (err) => {
        console.error('Failed to load GLB model:', err);
        viewer.error = 'Invalid 3D model asset pathway or connection timeout.';
        document.getElementById('error-message').textContent = viewer.error;
        document.getElementById('viewer-loading').classList.add('hidden');
        document.getElementById('viewer-error').classList.remove('hidden');
      }
    );
    
    // 8. Handle Resize
    viewer.resizeObserver = new ResizeObserver((entries) => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (viewer.renderer && viewer.camera) {
        viewer.camera.aspect = w / h;
        viewer.camera.updateProjectionMatrix();
        viewer.renderer.setSize(w, h);
      }
    });
    viewer.resizeObserver.observe(container);
    
  } catch (err) {
    console.error('WebGL Context crash:', err);
    viewer.error = 'Failed to compile WebGL context. Verify GPU hardware rendering.';
    document.getElementById('error-message').textContent = viewer.error;
    document.getElementById('viewer-loading').classList.add('hidden');
    document.getElementById('viewer-error').classList.remove('hidden');
  }
}

/**
 * Apply render mode (hologram vs realistic)
 */
function applyRenderMode(mode) {
  const viewer = state.viewer;
  const THREE_MODULE = THREE;
  
  if (!viewer.currentModel) return;
  
  viewer.currentModel.traverse((child) => {
    if (child.isMesh) {
      if (mode === 'hologram') {
        // Backup original material
        if (!child.userData.originalMaterial) {
          child.userData.originalMaterial = child.material;
        }
        
        // Apply wireframe glowing material
        child.material = new THREE_MODULE.MeshBasicMaterial({
          color: 0x06B6D4,
          wireframe: true,
          transparent: true,
          opacity: 0.5,
          blending: THREE_MODULE.AdditiveBlending,
          depthWrite: false
        });
      } else {
        // Restore original material
        if (child.userData.originalMaterial) {
          child.material = child.userData.originalMaterial;
        }
      }
    }
  });
  
  // Update grid and scanline
  if (viewer.gridHelper) {
    viewer.gridHelper.material.opacity = mode === 'hologram' ? 0.6 : 0.15;
  }
  if (viewer.scanLine) {
    viewer.scanLine.visible = mode === 'hologram';
  }
  
  // Update HUD display
  document.getElementById('render-mode-display').textContent = 
    mode === 'hologram' ? 'WIREFRAME_MATRIX' : 'PBR_METALLIC';
}

/**
 * Animation loop for 3D viewer
 */
function animate() {
  const viewer = state.viewer;
  viewer.animationFrameId = requestAnimationFrame(animate);
  
  // Update controls
  if (viewer.controls) {
    viewer.controls.update();
  }
  
  // Animate scanline
  if (viewer.scanLine && viewer.renderMode === 'hologram') {
    viewer.scanLine.position.y += 0.008 * viewer.scanDirection;
    if (viewer.scanLine.position.y >= viewer.scanYMax) {
      viewer.scanDirection = -1;
    } else if (viewer.scanLine.position.y <= viewer.scanYMin) {
      viewer.scanDirection = 1;
    }
  }
  
  if (viewer.renderer && viewer.scene && viewer.camera) {
    viewer.renderer.render(viewer.scene, viewer.camera);
  }
}

/**
 * Cleanup 3D viewer resources
 */
function disposeViewer() {
  const viewer = state.viewer;
  
  if (viewer.animationFrameId) {
    cancelAnimationFrame(viewer.animationFrameId);
  }
  if (viewer.resizeObserver) {
    viewer.resizeObserver.disconnect();
  }
  
  if (viewer.currentModel) {
    viewer.currentModel.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
        if (child.userData.originalMaterial) {
          child.userData.originalMaterial.dispose();
        }
      }
    });
  }
  
  if (viewer.gridHelper) {
    viewer.gridHelper.geometry.dispose();
    viewer.gridHelper.material.dispose();
  }
  
  if (viewer.scanLine) {
    viewer.scanLine.geometry.dispose();
    viewer.scanLine.material.dispose();
  }
  
  if (viewer.renderer) {
    viewer.renderer.dispose();
  }
  
  viewer.scene = null;
  viewer.camera = null;
  viewer.renderer = null;
  viewer.controls = null;
  viewer.currentModel = null;
}

// ═══════════════════════════════════════════════════════════════
// UI EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════

function setupViewerUI() {
  // Close modal button
  document.getElementById('close-model-viewer').addEventListener('click', () => {
    document.getElementById('model-viewer-modal').classList.add('hidden');
    disposeViewer();
  });
  
  // Toggle render mode
  document.getElementById('toggle-render-mode').addEventListener('click', () => {
    const viewer = state.viewer;
    viewer.renderMode = viewer.renderMode === 'hologram' ? 'realistic' : 'hologram';
    applyRenderMode(viewer.renderMode);
    
    const btn = document.getElementById('toggle-render-mode');
    btn.textContent = `MODE: ${viewer.renderMode.toUpperCase()}`;
    btn.classList.toggle('hologram-active');
  });
  
  // Toggle auto-rotate
  document.getElementById('toggle-auto-rotate').addEventListener('click', () => {
    const viewer = state.viewer;
    viewer.autoRotate = !viewer.autoRotate;
    
    if (viewer.controls) {
      viewer.controls.autoRotate = viewer.autoRotate;
    }
    
    const btn = document.getElementById('toggle-auto-rotate');
    btn.textContent = `ROTATION: ${viewer.autoRotate ? 'ON' : 'OFF'}`;
    btn.classList.toggle('rotate-active');
    
    document.getElementById('rotation-status').textContent = 
      viewer.autoRotate ? '0.15_RAD_S' : 'STATIC';
  });
  
  // Hide HUD
  document.getElementById('hide-hud-btn').addEventListener('click', () => {
    state.viewer.showHud = false;
    document.getElementById('viewer-hud').classList.add('hidden');
    document.getElementById('viewer-controls').classList.add('hidden');
    document.getElementById('show-hud-btn').classList.remove('hidden');
  });
  
  // Show HUD
  document.getElementById('show-hud-btn').addEventListener('click', () => {
    state.viewer.showHud = true;
    document.getElementById('viewer-hud').classList.remove('hidden');
    document.getElementById('viewer-controls').classList.remove('hidden');
    document.getElementById('show-hud-btn').classList.add('hidden');
  });
}

// ═══════════════════════════════════════════════════════════════
// APP INITIALIZATION
// ═══════════════════════════════════════════════════════════════

async function initApp() {
  console.log('🚀 Initializing VGU Holographic Map...');
  
  // Setup viewer UI handlers
  setupViewerUI();
  
  // Initialize map
  await initMap();
  
  console.log('✅ VGU Holographic Map initialized successfully');
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Export functions for global access (optional)
window.VGUMap = {
  selectBuilding,
  selectFloor,
  selectRoom,
  resetMap,
  init3DViewer,
  state
};
