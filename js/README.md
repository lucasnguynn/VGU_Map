# VGU Map - Modular JavaScript Architecture

## Overview

This directory contains the refactored modular JavaScript components for the VGU Map application. The monolithic code from `main.js` has been extracted into separate, purpose-built modules following best practices for maintainability, testability, and separation of concerns.

## Module Structure

```
/workspace/js/
├── config.js           # Centralized configuration & constants
├── data-service.js     # Data fetching and processing utilities
├── renderer.js         # SVG map rendering logic
└── room-service.js     # Room data lookup and management
```

## Modules

### 1. `config.js` - Configuration Module

Centralizes all configuration constants, API endpoints, building definitions, floor mappings, color themes, and application state structure.

**Exports:**
- `BUILDINGS` - Array of building configurations
- `BUILDING_CENTERS` - Coordinates for camera fly-to
- `CLUSTERS_DATA` - Cluster labels and metadata
- `DEPARTMENT_COLORS` - Color mapping for departments
- `MAP_CONFIG` - Map initialization parameters
- `VIEWER_CONFIG` - 3D viewer settings
- `API_ENDPOINTS` - Data source URLs
- `createInitialState()` - Factory function for app state

**Usage:**
```javascript
import { BUILDINGS, MAP_CONFIG, THEME } from './js/config.js';

console.log('Buildings:', BUILDINGS);
console.log('Default zoom:', MAP_CONFIG.defaultZoom);
```

### 2. `data-service.js` - Data Service Module

Encapsulates all data fetching logic with standardized error handling, data transformation utilities, and floor-based filtering.

**Key Functions:**
- `fetchJson(url)` - Fetch JSON with UTF-8 support
- `loadMapData()` - Load GeoJSON map data
- `loadRoomInfo()` - Load room information
- `syncAllData()` - Sync all data sources in parallel
- `transformInfoToLabs(infoData)` - Transform raw data to labs format
- `normalizeRoomInfo(infoData)` - Create keyed object from array
- `filterRoomsByFloor(rooms, floor)` - Filter by floor number
- `getFloorsWithLabs(buildingId, labs)` - Get floors with labs

**Usage:**
```javascript
import { syncAllData, loadRoomInfo, filterRoomsByFloor } from './js/data-service.js';

// Load all data
const data = await syncAllData();

// Load specific data
const rooms = await loadRoomInfo();
const filtered = filterRoomsByFloor(rooms, 2);
```

### 3. `renderer.js` - Renderer Module

Handles SVG generation from map data, viewBox calculation, dynamic font sizing, and room color determination.

**Key Functions:**
- `getPolygonCentroid(coordinates)` - Calculate polygon center
- `calculateBoundingBox(features)` - Get feature bounds
- `calculateViewBox(bbox, padding)` - Generate SVG viewBox
- `getDepartmentColor(department)` - Get color by department
- `getRoomColor(roomProperties)` - Determine room color
- `renderFloorPlan(geojson, svgElement, options)` - Render floor plan SVG
- `highlightRoom(svgElement, roomId, color)` - Highlight specific room

**Usage:**
```javascript
import { renderFloorPlan, getPolygonCentroid } from './js/renderer.js';

// Render floor plan
const svgEl = document.getElementById('floorplan-svg');
const success = renderFloorPlan(geojson, svgEl, {
  showLabels: true,
  opacity: 0.4
});

// Get room centroid for marker placement
const centroid = getPolygonCentroid(roomCoordinates);
```

### 4. `room-service.js` - Room Service Module

Provides room detail lookup, fallback data management, room categorization, and type-based color theming.

**Key Functions:**
- `getRoomDetails(roomId, roomsData)` - Get room by ID with fallback
- `getRoomCategory(room)` - Classify room type
- `getRoomColor(room)` - Get room color
- `searchRooms(query, rooms)` - Search rooms by query
- `filterRooms(rooms, filters)` - Multi-criteria filtering
- `groupRoomsBy(rooms, groupBy)` - Group rooms by property
- `sortRooms(rooms, sortBy, ascending)` - Sort rooms
- `validateRoomData(room)` - Validate room structure

**Usage:**
```javascript
import { getRoomDetails, searchRooms, filterRooms } from './js/room-service.js';

// Get room details
const room = getRoomDetails('LB-101', roomsData);

// Search rooms
const results = searchRooms('computer lab', allRooms);

// Filter rooms
const filtered = filterRooms(allRooms, {
  building_id: 'cluster-1',
  floor: 2
});
```

## Benefits of Refactoring

### 1. Maintainability
- **Single Responsibility**: Each module has one clear purpose
- **Easy Updates**: Change configuration in one place
- **Clear Dependencies**: Import only what you need

### 2. Testability
- **Unit Testing**: Individual functions can be tested in isolation
- **Mocking**: Easy to mock data services for testing
- **Coverage**: Clear boundaries for test coverage

### 3. Reusability
- **Shared Utilities**: Functions can be reused across components
- **Composable**: Mix and match modules as needed
- **Framework Agnostic**: Works with Vanilla JS, Vue, React, etc.

### 4. Readability
- **JSDoc Comments**: All functions are documented
- **Consistent Naming**: Follows naming conventions
- **Type Hints**: Clear parameter and return types

### 5. Scalability
- **Add Features**: New functionality without affecting existing code
- **Code Splitting**: Load modules on demand
- **Tree Shaking**: Unused code eliminated in builds

## Migration Guide

### From Inline Scripts to Modules

**Before (Inline in HTML):**
```html
<script>
  const BLDS = [{id:'bld_ad',name:'Admin Building',...}];
  function loadData() { fetch('/info_data.json')... }
</script>
```

**After (ES6 Modules):**
```html
<script type="module">
  import { BUILDINGS } from './js/config.js';
  import { loadRoomInfo } from './js/data-service.js';
  
  // Your code here
</script>
```

### Updating main.js

To fully adopt the modular architecture, update `main.js`:

```javascript
// Import modules
import { 
  BUILDINGS, 
  BUILDING_CENTERS, 
  CLUSTERS_DATA,
  createInitialState 
} from './js/config.js';

import { 
  loadRoomInfo, 
  transformInfoToLabs,
  getFloorsWithLabs 
} from './js/data-service.js';

import { 
  getPolygonCentroid,
  renderFloorPlan 
} from './js/renderer.js';

import { 
  getRoomDetails,
  getRoomColor 
} from './js/room-service.js';

// Use imported functions
const state = createInitialState();
const data = await loadRoomInfo();
const labs = transformInfoToLabs(data);
```

## Best Practices

### 1. Import Only What You Need
```javascript
// ✅ Good
import { fetchJson, loadRoomInfo } from './js/data-service.js';

// ❌ Avoid importing everything
import * as DataService from './js/data-service.js';
```

### 2. Handle Errors Gracefully
```javascript
try {
  const data = await loadRoomInfo();
  // Process data
} catch (error) {
  console.error('[App] Failed to load room info:', error);
  // Show user-friendly error
}
```

### 3. Use Constants from Config
```javascript
// ✅ Good
import { MAP_CONFIG } from './js/config.js';
map.setZoom(MAP_CONFIG.defaultZoom);

// ❌ Avoid magic numbers
map.setZoom(17.5);
```

### 4. Document Your Code
```javascript
/**
 * Calculate room availability
 * @param {Object} room - Room object
 * @returns {boolean} - Availability status
 */
export function isRoomAvailable(room) {
  // Implementation
}
```

## Next Steps

1. **Migrate main.js**: Update `main.js` to use these modules
2. **Add Tests**: Create unit tests for each module
3. **TypeScript**: Consider migrating to TypeScript for type safety
4. **Build Process**: Implement bundling with Vite or Webpack
5. **Documentation**: Generate API docs with JSDoc

## License

VGUMap - Vietnamese-German University Map System
