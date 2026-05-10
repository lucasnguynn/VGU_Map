/**
 * VGUMap Floor Plan Renderer
 * Handles SVG/Canvas rendering of floor plans with interactive features
 */

import { ROOM_CATEGORIES, ROOM_TYPE_COLORS } from './config.js';
import { isExcludedRoom } from './data-service.js';

/**
 * Generate SVG path string from room path segments
 * @param {Array} paths - Array of path segments {sx, sy, ex, ey}
 * @param {Function} mapX - X coordinate mapping function
 * @param {Function} mapY - Y coordinate mapping function
 * @returns {string} - SVG path d attribute string
 */
export function buildPathString(paths, mapX, mapY) {
    let dString = '';
    let lastX = null;
    let lastY = null;

    paths.forEach(p => {
        // Start new subpath if discontinuity detected
        if (lastX === null || Math.abs(p.sx - lastX) > 0.1 || Math.abs(p.sy - lastY) > 0.1) {
            dString += `M ${mapX(p.sx).toFixed(2)} ${mapY(p.sy).toFixed(2)} `;
        }
        dString += `L ${mapX(p.ex).toFixed(2)} ${mapY(p.ey).toFixed(2)} `;
        lastX = p.ex;
        lastY = p.ey;
    });

    return dString + 'Z';
}

/**
 * Get room category for styling
 * @param {string} roomNum - Room number
 * @returns {string} - Category key
 */
export function getRoomCategory(roomNum) {
    if (ROOM_CATEGORIES[roomNum]) return ROOM_CATEGORIES[roomNum];
    if (/^WC/i.test(roomNum)) return 'wc';
    if (/^(LB|CR)/i.test(roomNum)) return 'lb';
    return 'default';
}

/**
 * Get fill and stroke colors for a room based on its type
 * @param {string} roomNum - Room number
 * @returns {Object} - {fillColor, strokeColor}
 */
export function getRoomColors(roomNum) {
    const category = getRoomCategory(roomNum);

    // Modern, premium color palette
    const colors = {
        wc: { fill: '#c5e3f0', stroke: '#3d7a99' },
        lb: { fill: '#dce1f2', stroke: '#6b7aa8' },
        hall: { fill: '#dff0e6', stroke: '#3a7a5a' },
        large: { fill: '#dff0e6', stroke: '#3a7a5a' },
        default: { fill: '#e8edf8', stroke: '#7a8fb8' }
    };

    return colors[category] || colors.default;
}

/**
 * Calculate dynamic font size for room label
 * @param {number} roomWidth - Room width in SVG units
 * @param {number} roomHeight - Room height in SVG units
 * @param {string} roomNum - Room number text
 * @param {number} baseFontSize - Base font size
 * @returns {number} - Calculated font size
 */
export function calculateFontSize(roomWidth, roomHeight, roomNum, baseFontSize = 12) {
    const maxFontByWidth = roomWidth / Math.max(roomNum.length * 0.65, 1);
    const maxFontByHeight = roomHeight * 0.45;
    return Math.max(Math.min(baseFontSize, maxFontByWidth, maxFontByHeight), 2);
}

/**
 * Render floor plan as SVG
 * @param {Object} rooms - Rooms object with path data
 * @param {Object} bounds - Map bounds {minMapX, minMapY, maxMapX, maxMapY}
 * @param {string} floorId - Floor identifier
 * @returns {string} - Complete SVG markup
 */
export function renderFloorPlanSVG(rooms, bounds, floorId) {
    const { minMapX, minMapY, maxMapX, maxMapY } = bounds;

    // Calculate dimensions
    const mapWidth = maxMapX - minMapX;
    const mapHeight = maxMapY - minMapY;

    // Add uniform padding (5% on each side)
    const padX = mapWidth * 0.05;
    const padY = mapHeight * 0.05;
    const paddedWidth = mapWidth + padX * 2;
    const paddedHeight = mapHeight + padY * 2;

    // Calculate viewBox dimensions maintaining aspect ratio
    const vbW = 1000;
    const uniformScale = vbW / paddedWidth;
    const vbH = paddedHeight * uniformScale;

    // Coordinate mapping functions with Y-axis inversion
    const mapX = (x) => (x - minMapX + padX) * uniformScale;
    const mapY = (y) => (maxMapY - y + padY) * uniformScale;

    // Build SVG content
    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW.toFixed(2)} ${vbH.toFixed(2)}" style="width:100%;height:auto;display:block" role="img" aria-label="Floor plan for ${floorId}">`;

    // Background
    svgContent += `<rect x="0" y="0" width="${vbW.toFixed(2)}" height="${vbH.toFixed(2)}" fill="#eef2f9"/>`;

    // Render each room
    for (const [roomNum, rData] of Object.entries(rooms)) {
        const dString = buildPathString(rData.paths, mapX, mapY);

        // Calculate room center for text placement
        const textX = mapX((rData.minX + rData.maxX) / 2);
        const textY = mapY((rData.minY + rData.maxY) / 2);
        const roomWidth = Math.abs(mapX(rData.maxX) - mapX(rData.minX));
        const roomHeight = Math.abs(mapY(rData.minY) - mapY(rData.maxY));

        // Dynamic font size calculation
        const fontSize = calculateFontSize(roomWidth, roomHeight, roomNum, vbW * 0.008);
        const strokeW = Math.max(vbW * 0.0008, 0.4);

        // Get colors based on room type
        const { fillColor, strokeColor } = getRoomColors(roomNum);

        // Check if room is excluded (disabled zone)
        const isDisabled = isExcludedRoom(roomNum);
        const pointerEvents = isDisabled ? 'none' : 'all';
        const cursorStyle = isDisabled ? 'default' : 'pointer';
        const opacity = isDisabled ? 0.5 : 1;

        // Create room group with click handler
        svgContent += `
        <g class="room-group ${isDisabled ? 'disabled-room' : 'active-room'}" 
           data-room="${roomNum}" 
           onclick="${isDisabled ? '' : `rC('${roomNum}')`}" 
           style="cursor:${cursorStyle}; pointer-events:${pointerEvents}; opacity:${opacity}"
           role="${isDisabled ? 'presentation' : 'button'}"
           aria-label="${roomNum}${isDisabled ? ' (not clickable)' : ''}">
          <path d="${dString}" 
                fill="${fillColor}" 
                stroke="${strokeColor}" 
                stroke-width="${strokeW.toFixed(2)}"
                class="room-path"
                data-room="${roomNum}">
            <title>${roomNum}${isDisabled ? ' - Disabled Zone' : ''}</title>
          </path>
          <text x="${textX.toFixed(2)}" 
                y="${textY.toFixed(2)}" 
                text-anchor="middle" 
                dominant-baseline="middle" 
                font-family="IBM Plex Sans, sans-serif" 
                font-size="${fontSize.toFixed(2)}" 
                font-weight="600" 
                fill="#002554" 
                pointer-events="none" 
                class="room-label"
                style="paint-order:stroke; stroke:#ffffff; stroke-width:${(fontSize * 0.25).toFixed(2)}px">
            ${roomNum}
          </text>
        </g>`;
    }

    return svgContent + '</svg>';
}

/**
 * Initialize map resize handler
 * @param {Object} lMap - Leaflet map instance
 * @param {Array} globalBounds - Map bounds
 */
export function setupMapResizeHandler(lMap, globalBounds) {
    let resizeTimeout;

    const handleResize = () => {
        if (!lMap || !globalBounds) return;

        clearTimeout(resizeTimeout);

        resizeTimeout = setTimeout(() => {
            lMap.invalidateSize(false);
            lMap.fitBounds(globalBounds, { animate: true, duration: 0.3 });
        }, 250);
    };

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });

    return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('orientationchange', handleResize);
    };
}

/**
 * Apply hover effect to room polygon
 * @param {Object} polygon - Leaflet polygon instance
 * @param {boolean} isHovering - Whether mouse is hovering
 * @param {Object} defaultStyle - Default polygon style
 */
export function applyPolygonHover(polygon, isHovering, defaultStyle) {
    if (isHovering) {
        polygon.setStyle({ fillOpacity: 0.15, weight: 3 });
    } else {
        polygon.setStyle(defaultStyle);
    }
}

/**
 * Highlight selected polygon
 * @param {Object} polygon - Leaflet polygon instance
 * @param {Object} highlightStyle - Highlight style object
 */
export function highlightPolygon(polygon, highlightStyle) {
    if (polygon) {
        polygon.setStyle(highlightStyle);
    }
}

/**
 * Create loading skeleton for image
 * @returns {string} - HTML string for loading skeleton
 */
export function createImageSkeleton() {
    return `
    <div class="image-skeleton" style="
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
        display: flex;
        align-items: center;
        justify-content: center;
    ">
        <style>
            @keyframes shimmer {
                0% { background-position: -200% 0; }
                100% { background-position: 200% 0; }
            }
        </style>
        <div style="text-align: center; color: #8896a8; font-size: 14px;">
            <div style="font-size: 32px; margin-bottom: 8px;">🖼️</div>
            <div>Loading image...</div>
        </div>
    </div>`;
}

/**
 * Create room image element with Google Drive URL
 * @param {string} imageId - Google Drive file ID
 * @param {string} roomCode - Room code for alt text
 * @returns {string} - HTML string for image element
 */
export function createRoomImage(imageId, roomCode) {
    const driveUrl = `https://drive.google.com/thumbnail?id=${imageId}&sz=w1000`;

    return `
    <img src="${driveUrl}"
         alt="Room ${roomCode}"
         style="width: 100%; height: 100%; object-fit: contain; display: block; padding: 4px;"
         loading="lazy"
         onload="this.style.opacity = 1;"
         onerror="this.parentElement.innerHTML = '<div style=\'text-align:center;padding:22px 14px\'><div style=\'font-size:42px;margin-bottom:10px\'>📷</div><div style=\'font-size:13px;font-weight:700;color:#002554;margin-bottom:3px\'>Image not available</div><div style=\'font-size:11px;color:#8896a8\'>${roomCode}</div></div>';">`;
}

/**
 * Debounce utility function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced function
 */
export function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Fade in element with smooth transition
 * @param {HTMLElement} element - Element to fade in
 * @param {number} duration - Animation duration in ms
 */
export function fadeIn(element, duration = 300) {
    if (!element) return;

    element.style.opacity = '0';
    element.style.transition = `opacity ${duration}ms ease-in-out`;

    requestAnimationFrame(() => {
        element.style.opacity = '1';
    });
}

/**
 * Fade out element with smooth transition
 * @param {HTMLElement} element - Element to fade out
 * @param {number} duration - Animation duration in ms
 * @returns {Promise} - Promise that resolves when animation completes
 */
export function fadeOut(element, duration = 300) {
    return new Promise((resolve) => {
        if (!element) {
            resolve();
            return;
        }

        element.style.transition = `opacity ${duration}ms ease-in-out`;

        requestAnimationFrame(() => {
            element.style.opacity = '0';

            setTimeout(() => {
                resolve();
            }, duration);
        });
    });
}
