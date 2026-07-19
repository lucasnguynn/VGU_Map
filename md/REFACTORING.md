# VGUMap - Refactored Codebase

## Overview

This repository contains the VGUMap application - a room and building lookup system for Vietnamese-German University. The codebase has been refactored to improve maintainability, readability, and separation of concerns.

## Project Structure

```
/workspace/
├── index.html              # Main application (single-page app)
├── fetch_sheets.js         # Node.js cron script for data synchronization
├── map_data.json           # Cached map boundary data
├── info_data.json          # Cached room information (generated)
├── drive_data.json         # Cached drive image mappings (generated)
├── js/                     # Modular JavaScript components
│   ├── config.js           # Centralized configuration & constants
│   ├── data-service.js     # Data fetching and processing utilities
│   ├── renderer.js         # SVG map rendering logic
│   └── room-service.js     # Room data lookup and management
└── REFACTORING.md          # This file
```

## Refactoring Changes

### 1. **Modular Architecture** (`/js/` directory)

The monolithic inline JavaScript in `index.html` has been extracted into separate, purpose-built modules:

#### `config.js`
- Centralized all configuration constants
- API endpoints
- Building definitions
- Floor and room mappings
- Color themes and styling constants
- Application state structure

**Benefits:**
- Single source of truth for configuration
- Easy to update API endpoints or building data
- Consistent constants across the application

#### `data-service.js`
- Encapsulated data fetching logic
- Standardized error handling
- Data transformation utilities
- Floor-based filtering
- Room path construction

**Benefits:**
- Reusable data operations
- Clear separation from UI logic
- Testable data layer

#### `renderer.js`
- SVG generation from map data
- ViewBox calculation with proper scaling
- Dynamic font sizing for room labels
- Room color determination
- Placeholder rendering

**Benefits:**
- Isolated rendering logic
- Consistent visual output
- Easy to modify styling

#### `room-service.js`
- Room detail lookup
- Fallback data management
- Room categorization
- Type-based color theming

**Benefits:**
- Centralized room data access
- Graceful degradation with fallback data

### 2. **Improved `fetch_sheets.js`**

The cron script has been restructured with:
- Clear section separators using visual dividers
- Consolidated configuration object
- Streamlined task execution loop
- Better error messages
- Reduced code duplication

**Before:** Three separate try-catch blocks for each API
**After:** Single loop over task configuration array

### 3. **Code Quality Improvements**

- **JSDoc Comments**: All functions now have proper documentation
- **Consistent Naming**: Variables and functions follow consistent naming conventions
- **Error Handling**: Standardized error handling patterns
- **DRY Principle**: Eliminated code duplication
- **Single Responsibility**: Each function/module has one clear purpose

## Usage

### Running the Data Sync Script

```bash
# Manual execution
node fetch_sheets.js

# Cron setup (every 10 minutes)
crontab -e
# Add: 0/10 * * * * /usr/bin/node /path/to/fetch_sheets.js
```

### Using the Modular JavaScript

To use the refactored modules in a modern build setup:

```html
<script type="module">
  import { BUILDINGS, FLOOR_ROOMS } from './js/config.js';
  import { loadMapData, loadRoomInfo } from './js/data-service.js';
  import { renderFloorMap } from './js/renderer.js';
  import { getRoomDetails } from './js/room-service.js';
  
  // Your application code here
</script>
```

**Note:** The current `index.html` still contains inline JavaScript for backward compatibility. To fully adopt the modular architecture, the inline scripts should be migrated to use these ES6 modules.

## Migration Guide

To complete the migration to the modular architecture:

1. **Replace inline configuration** in `index.html` with imports from `config.js`
2. **Replace data fetching** code with `data-service.js` functions
3. **Replace map rendering** logic with `renderer.js` functions
4. **Replace room lookup** code with `room-service.js` functions

Example migration:

```javascript
// OLD: Inline configuration
const BLDS = [{id:'bld_ad',name:'Admin Building',act:true,fl:6}, ...];

// NEW: Import from module
import { BUILDINGS } from './js/config.js';
```

## Benefits of Refactoring

1. **Maintainability**: Easier to find and update specific functionality
2. **Testability**: Individual modules can be unit tested
3. **Reusability**: Functions can be reused across different parts of the app
4. **Readability**: Clear separation of concerns with documented interfaces
5. **Scalability**: Easier to add new features without affecting existing code
6. **Debugging**: Easier to trace and fix issues in isolated modules

## Next Steps

1. Migrate `index.html` to use ES6 modules
2. Add unit tests for each module
3. Implement a build process (e.g., Webpack, Vite) for production
4. Add TypeScript for type safety
5. Implement proper state management

## License

VGUMap - Vietnamese-German University Map System
