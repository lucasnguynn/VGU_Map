/**
 * VGU Map - Renderer Module
 * Handles SVG and map rendering logic for floor plans and room visualization
 */

import { DEPARTMENT_COLORS, DEFAULT_COLOR } from './config.js';

/**
 * Calculate polygon centroid from GeoJSON coordinates
 * @param {Array} coordinates - GeoJSON polygon coordinates
 * @returns {Array<number>} - [longitude, latitude] of centroid
 */
export function getPolygonCentroid(coordinates) {
  if (!coordinates || coordinates.length === 0) {
    return [0, 0];
  }

  const ring = coordinates[0];
  let x = 0, y = 0;

  for (let i = 0; i < ring.length; i++) {
    x += ring[i][0];
    y += ring[i][1];
  }

  return [x / ring.length, y / ring.length];
}

/**
 * Calculate bounding box for GeoJSON features
 * @param {Array} features - Array of GeoJSON features
 * @returns {Object} - Bounding box with min/max coordinates
 */
export function calculateBoundingBox(features) {
  if (!features || features.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  features.forEach(feature => {
    if (feature.geometry && feature.geometry.coordinates) {
      const coords = feature.geometry.coordinates[0];
      coords.forEach(coord => {
        minX = Math.min(minX, coord[0]);
        minY = Math.min(minY, coord[1]);
        maxX = Math.max(maxX, coord[0]);
        maxY = Math.max(maxY, coord[1]);
      });
    }
  });

  return { minX, minY, maxX, maxY };
}

/**
 * Calculate viewBox for SVG rendering
 * @param {Object} bbox - Bounding box object
 * @param {number} padding - Padding around the view
 * @returns {string} - SVG viewBox attribute value
 */
export function calculateViewBox(bbox, padding = 0.0001) {
  const { minX, minY, maxX, maxY } = bbox;
  const width = maxX - minX;
  const height = maxY - minY;

  return `${minX - padding} ${minY - padding} ${width + padding * 2} ${height + padding * 2}`;
}

/**
 * Get department color from mapping
 * @param {string} department - Department name
 * @returns {string} - Hex color code
 */
export function getDepartmentColor(department) {
  if (!department) {
    return DEFAULT_COLOR;
  }

  for (const [key, color] of Object.entries(DEPARTMENT_COLORS)) {
    if (department.includes(key)) {
      return color;
    }
  }

  return DEFAULT_COLOR;
}

/**
 * Determine room color based on type or department
 * @param {Object} roomProperties - Room properties object
 * @returns {string} - Hex color code
 */
export function getRoomColor(roomProperties) {
  if (!roomProperties) {
    return DEFAULT_COLOR;
  }

  // Check for department-based color
  if (roomProperties.department) {
    const deptColor = getDepartmentColor(roomProperties.department);
    if (deptColor !== DEFAULT_COLOR) {
      return deptColor;
    }
  }

  // Check for type-based color
  if (roomProperties.type === 'laboratory') {
    return '#EF5A24';
  }

  return DEFAULT_COLOR;
}

/**
 * Calculate dynamic font size based on room area
 * @param {Array} coordinates - Room polygon coordinates
 * @param {number} minSize - Minimum font size (default: 10)
 * @param {number} maxSize - Maximum font size (default: 16)
 * @returns {number} - Calculated font size
 */
export function calculateDynamicFontSize(coordinates, minSize = 10, maxSize = 16) {
  if (!coordinates || coordinates.length === 0) {
    return minSize;
  }

  const bbox = calculateBoundingBox([{ geometry: { coordinates } }]);
  const area = (bbox.maxX - bbox.minX) * (bbox.maxY - bbox.minY);

  // Logarithmic scale for font size
  const fontSize = minSize + Math.log(area * 1000000) * 2;
  return Math.min(Math.max(fontSize, minSize), maxSize);
}

/**
 * Generate SVG path from GeoJSON polygon
 * @param {Array} coordinates - GeoJSON polygon coordinates
 * @returns {string} - SVG path d attribute
 */
export function generateSvgPath(coordinates) {
  if (!coordinates || coordinates.length === 0) {
    return '';
  }

  const ring = coordinates[0];
  let path = '';

  for (let i = 0; i < ring.length; i++) {
    const [x, y] = ring[i];
    if (i === 0) {
      path += `M ${x} ${y}`;
    } else {
      path += ` L ${x} ${y}`;
    }
  }

  path += ' Z'; // Close path
  return path;
}

/**
 * Render placeholder for missing floor plan
 * @param {SVGSVGElement} svgElement - Target SVG element
 * @param {string} message - Placeholder message
 */
export function renderPlaceholder(svgElement, message = 'No data available') {
  if (!svgElement) {
    console.error('[Renderer] SVG element not found');
    return;
  }

  svgElement.innerHTML = `
    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="#6B7280" font-size="14">
      ${message}
    </text>
  `;
}

/**
 * Render floor plan as SVG
 * @param {Object} geojson - Floor plan GeoJSON
 * @param {SVGSVGElement} svgElement - Target SVG element
 * @param {Object} options - Rendering options
 * @returns {boolean} - Success status
 */
export function renderFloorPlan(geojson, svgElement, options = {}) {
  if (!geojson || !geojson.features || !svgElement) {
    console.error('[Renderer] Invalid geojson or SVG element');
    return false;
  }

  const {
    showLabels = true,
    showOutlines = true,
    opacity = 0.4,
    outlineWidth = 2,
    outlineColor = '#EF5A24'
  } = options;

  try {
    // Calculate bounding box and viewBox
    const bbox = calculateBoundingBox(geojson.features);
    const viewBox = calculateViewBox(bbox);

    // Clear existing content
    svgElement.innerHTML = '';

    // Set viewBox
    svgElement.setAttribute('viewBox', viewBox);

    // Create groups for fills and outlines
    const fillGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    fillGroup.setAttribute('class', 'room-fills');
    svgElement.appendChild(fillGroup);

    const outlineGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    outlineGroup.setAttribute('class', 'room-outlines');
    svgElement.appendChild(outlineGroup);

    const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    labelGroup.setAttribute('class', 'room-labels');
    svgElement.appendChild(labelGroup);

    // Render each room
    geojson.features.forEach((feature, index) => {
      if (!feature.geometry || !feature.geometry.coordinates) {
        return;
      }

      const props = feature.properties || {};
      const roomId = props.room_id || `room-${index}`;
      const roomName = props.name || roomId;
      const color = getRoomColor(props);

      // Create path element
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', generateSvgPath(feature.geometry.coordinates));
      path.setAttribute('fill', color);
      path.setAttribute('fill-opacity', opacity.toString());
      path.setAttribute('stroke', 'none');
      path.setAttribute('data-room-id', roomId);
      path.setAttribute('class', 'room-polygon');
      fillGroup.appendChild(path);

      // Create outline
      if (showOutlines) {
        const outline = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        outline.setAttribute('d', generateSvgPath(feature.geometry.coordinates));
        outline.setAttribute('fill', 'none');
        outline.setAttribute('stroke', outlineColor);
        outline.setAttribute('stroke-width', outlineWidth.toString());
        outline.setAttribute('stroke-opacity', '0.8');
        outline.setAttribute('data-room-id', roomId);
        outline.setAttribute('class', 'room-outline');
        outlineGroup.appendChild(outline);
      }

      // Add label
      if (showLabels) {
        const centroid = getPolygonCentroid(feature.geometry.coordinates);
        const fontSize = calculateDynamicFontSize(feature.geometry.coordinates);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', centroid[0].toString());
        text.setAttribute('y', centroid[1].toString());
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('fill', '#FFFFFF');
        text.setAttribute('font-size', fontSize.toString());
        text.setAttribute('font-weight', '600');
        text.setAttribute('pointer-events', 'none');
        text.setAttribute('data-room-id', roomId);
        text.setAttribute('class', 'room-label');
        text.textContent = roomId;
        labelGroup.appendChild(text);
      }
    });

    return true;
  } catch (error) {
    console.error('[Renderer] Failed to render floor plan:', error);
    return false;
  }
}

/**
 * Highlight a specific room in the SVG
 * @param {SVGSVGElement} svgElement - SVG element containing rooms
 * @param {string} roomId - Room ID to highlight
 * @param {string} highlightColor - Color for highlighting
 */
export function highlightRoom(svgElement, roomId, highlightColor = '#EF5A24') {
  if (!svgElement || !roomId) {
    return;
  }

  // Reset all rooms
  svgElement.querySelectorAll('.room-polygon').forEach(el => {
    el.setAttribute('fill-opacity', '0.4');
  });

  // Highlight selected room
  const roomEl = svgElement.querySelector(`[data-room-id="${roomId}"]`);
  if (roomEl) {
    roomEl.setAttribute('fill-opacity', '0.8');
    roomEl.setAttribute('stroke', highlightColor);
    roomEl.setAttribute('stroke-width', '3');
  }
}

/**
 * Export default renderer object
 */
export default {
  getPolygonCentroid,
  calculateBoundingBox,
  calculateViewBox,
  getDepartmentColor,
  getRoomColor,
  calculateDynamicFontSize,
  generateSvgPath,
  renderPlaceholder,
  renderFloorPlan,
  highlightRoom
};
