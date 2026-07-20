/**
 * VGU Map - Configuration Module
 * Centralized configuration constants and application state
 */

// ═══════════════════════════════════════════════════════════════
// BUILDING CONFIGURATION
// ═══════════════════════════════════════════════════════════════

export const BUILDINGS = [
  { id: 'cluster-1', name: 'Materials Science / Physics', active: true, floors: 6 },
  { id: 'cluster-2', name: 'Electrical Engineering / IT / CS', active: true, floors: 6 },
  { id: 'cluster-3', name: 'Mechanical Eng. / Mechatronics', active: true, floors: 6 },
  { id: 'cluster-5', name: 'Chemical & Civil Engineering', active: true, floors: 6 },
  { id: 'cluster-6', name: 'Business / Finance', active: true, floors: 6 }
];

export const BUILDING_CENTERS = {
  'cluster-1': [106.6150547, 11.1086567],
  'cluster-2': [106.6152379, 11.1081542],
  'cluster-3': [106.6154201, 11.1077056],
  'cluster-5': [106.6160420, 11.1088469],
  'cluster-6': [106.6162763, 11.1081780]
};

export const CLUSTERS_DATA = [
  { id: 'cluster-1', label: 'Cluster 1', name: 'Materials Science / Physics', coords: [106.6150547, 11.1086567] },
  { id: 'cluster-2', label: 'Cluster 2', name: 'Electrical Engineering / IT / CS', coords: [106.6152379, 11.1081542] },
  { id: 'cluster-3', label: 'Cluster 3', name: 'Mechanical Eng. / Mechatronics', coords: [106.6154201, 11.1077056] },
  { id: 'cluster-5', label: 'Cluster 5', name: 'Chemical & Civil Engineering', coords: [106.6160420, 11.1088469] },
  { id: 'cluster-6', label: 'Cluster 6', name: 'Business / Finance', coords: [106.6162763, 11.1081780] }
];

export const BUILDING_NAME_MAP = {
  'cluster-1': 'Academic Cluster 1',
  'cluster-2': 'Academic Cluster 2',
  'cluster-3': 'Academic Cluster 3',
  'cluster-5': 'Academic Cluster 5',
  'cluster-6': 'Academic Cluster 6'
};

// ═══════════════════════════════════════════════════════════════
// FLOOR & ROOM MAPPINGS
// ═══════════════════════════════════════════════════════════════

export const FLOOR_ROOMS = {
  'cluster-1': 'msi-floor',
  'cluster-2': 'msi-floor',
  'cluster-3': 'msi-floor',
  'cluster-5': 'msi-floor',
  'cluster-6': 'msi-floor'
};

export const DEFAULT_FLOORS = [2, 1];

// ═══════════════════════════════════════════════════════════════
// COLOR THEMES AND STYLING CONSTANTS
// ═══════════════════════════════════════════════════════════════

export const DEPARTMENT_COLORS = {
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

export const DEFAULT_COLOR = '#1E293B';

export const THEME = {
  primary: '#EF5A24',
  secondary: '#06B6D4',
  background: '#070a12',
  hologram: '#06B6D4',
  wireframe: '#EF5A24'
};

// ═══════════════════════════════════════════════════════════════
// MAP CONFIGURATION
// ═══════════════════════════════════════════════════════════════

export const MAP_CONFIG = {
  defaultCenter: [106.6155, 11.1083],
  defaultZoom: 17.5,
  defaultPitch: 45,
  defaultBearing: -20,
  buildingZoom: 19.5,
  roomZoom: 20.8,
  maxZoom: 22,
  minZoom: 0
};

export const MAP_STYLES = {
  darkMatter: {
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
  }
};

// ═══════════════════════════════════════════════════════════════
// APPLICATION STATE STRUCTURE
// ═══════════════════════════════════════════════════════════════

export const createInitialState = () => ({
  // Map state
  map: null,
  mapLoaded: false,
  selectedBuilding: null,
  selectedFloor: null,
  selectedRoomId: null,
  zoomLevel: MAP_CONFIG.defaultZoom,
  pitchLevel: MAP_CONFIG.defaultPitch,
  mapCenter: [...MAP_CONFIG.defaultCenter],
  
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
    showHud: typeof window !== 'undefined' && window.innerWidth > 768 && window.innerHeight > 500
  }
});

// ═══════════════════════════════════════════════════════════════
// API ENDPOINTS
// ═══════════════════════════════════════════════════════════════

export const API_ENDPOINTS = {
  mapData: '/json-tung/map_data.json',
  infoData: '/info_data.json',
  driveData: '/drive_data.json',
  campusBuildings: '/public/campus-buildings.json',
  floorsConfig: '/floors-config.json'
};

// ═══════════════════════════════════════════════════════════════
// 3D VIEWER CONFIGURATION
// ═══════════════════════════════════════════════════════════════

export const VIEWER_CONFIG = {
  camera: {
    fov: 45,
    near: 0.1,
    far: 100,
    initialPosition: { x: 0, y: 0, z: 5 }
  },
  controls: {
    enableDamping: true,
    dampingFactor: 0.05,
    maxPolarAngle: Math.PI / 2 + 0.1,
    minDistance: 1,
    maxDistance: 15,
    autoRotateSpeed: 1.2
  },
  lighting: {
    ambient: { color: 0xffffff, intensity: 0.4 },
    keyLight: { color: 0xffffff, intensity: 0.8, position: { x: 5, y: 8, z: 5 } },
    cyanLight: { color: 0x06b6d4, intensity: 1.5, distance: 15, position: { x: -4, y: 2, z: -4 } },
    orangeLight: { color: 0xef5a24, intensity: 1.8, distance: 15, position: { x: 4, y: -2, z: 4 } }
  },
  grid: {
    size: 10,
    divisions: 24,
    color1: 0xef5a24,
    color2: 0x06b6d4,
    positionY: -1.2
  },
  scanline: {
    speed: 0.008,
    radiusMultiplier: 0.7,
    segments: 32
  }
};

// Export all as a single config object for convenience
export const Config = {
  BUILDINGS,
  BUILDING_CENTERS,
  CLUSTERS_DATA,
  BUILDING_NAME_MAP,
  FLOOR_ROOMS,
  DEFAULT_FLOORS,
  DEPARTMENT_COLORS,
  DEFAULT_COLOR,
  THEME,
  MAP_CONFIG,
  MAP_STYLES,
  API_ENDPOINTS,
  VIEWER_CONFIG,
  createInitialState
};
