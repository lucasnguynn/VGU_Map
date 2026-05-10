/**
 * VGUMap SVG Renderer
 * Generates SVG floor maps from room boundary data
 */

import { ROOM_CATEGORIES, ROOM_TYPE_COLORS } from './config.js';

/**
 * Calculate the optimal viewBox and scaling for the map
 * @param {Object} bounds - Map bounds (minMapX, minMapY, maxMapX, maxMapY)
 * @returns {Object} - ViewBox configuration and mapping functions
 */
export function calculateViewBox(bounds) {
    const { minMapX, minMapY, maxMapX, maxMapY } = bounds;
    
    let mapWidth = maxMapX - minMapX;
    let mapHeight = maxMapY - minMapY;

    // Add uniform padding (5% on each side)
    const padX = mapWidth * 0.05;
    const padY = mapHeight * 0.05;

    const paddedWidth = mapWidth + padX * 2;
    const paddedHeight = mapHeight + padY * 2;

    // Use a base viewBox width and calculate height using uniform scale
    const vbW = 1000;
    const uniformScale = vbW / paddedWidth;
    const vbH = paddedHeight * uniformScale;

    // Mapping functions with Y-axis inversion
    const mapX = (x) => (x - minMapX + padX) * uniformScale;
    const mapY = (y) => (maxMapY - y + padY) * uniformScale;

    return { vbW, vbH, mapX, mapY };
}

/**
 * Determine room color based on type/category
 * @param {string} roomNum - Room number
 * @returns {Object} - Fill and stroke colors
 */
export function getRoomColors(roomNum) {
    let fillColor = '#e8edf8';
    let strokeColor = '#7a8fb8';

    if (/^WC/i.test(roomNum)) {
        fillColor = '#c5e3f0';
        strokeColor = '#3d7a99';
    } else if (/^(LB|CR)/i.test(roomNum)) {
        fillColor = '#dce1f2';
        strokeColor = '#6b7aa8';
    } else if (ROOM_CATEGORIES[roomNum] || roomNum.includes('Hội trường')) {
        fillColor = '#dff0e6';
        strokeColor = '#3a7a5a';
    }

    return { fillColor, strokeColor };
}

/**
 * Calculate optimal font size for room label
 * @param {number} roomWidth - Width of the room in SVG coordinates
 * @param {number} roomHeight - Height of the room in SVG coordinates
 * @param {string} roomNum - Room number text
 * @param {number} vbW - ViewBox width
 * @returns {number} - Font size
 */
export function calculateFontSize(roomWidth, roomHeight, roomNum, vbW) {
    const baseFontSize = vbW * 0.008;
    const maxFontByWidth = roomWidth / Math.max(roomNum.length * 0.65, 1);
    const maxFontByHeight = roomHeight * 0.45;
    
    return Math.max(Math.min(baseFontSize, maxFontByWidth, maxFontByHeight), 2);
}

/**
 * Generate SVG path string from room segments
 * @param {Array} paths - Array of path segments
 * @param {Function} mapX - X coordinate mapping function
 * @param {Function} mapY - Y coordinate mapping function
 * @returns {string} - SVG path d attribute
 */
export function generatePathData(paths, mapX, mapY) {
    let dString = '';
    let lastX = null;
    let lastY = null;

    paths.forEach(p => {
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
 * Render a complete SVG floor map
 * @param {Object} rooms - Rooms object with path data
 * @param {Object} viewBoxConfig - ViewBox configuration
 * @returns {string} - Complete SVG markup
 */
export function renderFloorMap(rooms, viewBoxConfig) {
    const { vbW, vbH, mapX, mapY } = viewBoxConfig;

    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}" style="width:100%;height:auto;display:block">
      <rect x="0" y="0" width="${vbW}" height="${vbH}" fill="#eef2f9"/>`;

    for (const [roomNum, rData] of Object.entries(rooms)) {
        const dString = generatePathData(rData.paths, mapX, mapY);

        // Calculate room center for text placement
        const textX = mapX((rData.minX + rData.maxX) / 2);
        const textY = mapY((rData.minY + rData.maxY) / 2);
        const roomWidth = Math.abs(mapX(rData.maxX) - mapX(rData.minX));
        const roomHeight = Math.abs(mapY(rData.minY) - mapY(rData.maxY));

        // Dynamic font-size calculation
        const fontSize = calculateFontSize(roomWidth, roomHeight, roomNum, vbW);
        const strokeW = Math.max(vbW * 0.0008, 0.4);

        const { fillColor, strokeColor } = getRoomColors(roomNum);

        svgContent += `
        <g onclick="rC('${roomNum}')" style="cursor:pointer">
          <path d="${dString}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeW}">
            <title>${roomNum}</title>
          </path>
          <text x="${textX.toFixed(2)}" y="${textY.toFixed(2)}" 
                text-anchor="middle" dominant-baseline="middle" 
                font-family="IBM Plex Sans,sans-serif" 
                font-size="${fontSize.toFixed(2)}" 
                font-weight="600" 
                fill="#002554" 
                pointer-events="none" 
                style="paint-order:stroke;stroke:#ffffff;stroke-width:${fontSize * 0.25}px">
            ${roomNum}
          </text>
        </g>`;
    }

    return svgContent + '</svg>';
}

/**
 * Generate a placeholder SVG when no data is available
 * @param {string} message - Message to display
 * @param {string} floorName - Floor name
 * @returns {string} - Placeholder SVG markup
 */
export function renderPlaceholder(message, floorName) {
    return `<svg viewBox="0 0 800 280" style="width:100%;height:auto;display:block">
      <rect width="800" height="280" fill="#edf0f8"/>
      <rect x="20" y="20" width="760" height="240" fill="none" stroke="#8fa0c0" stroke-width="1.5" rx="4"/>
      <text x="400" y="140" text-anchor="middle" dominant-baseline="middle" 
            font-family="IBM Plex Sans,sans-serif" font-size="14" fill="#8896a8">
        ${message || 'Dữ liệu trên sheet trống hoặc sai cấu trúc cho'} ${floorName}
      </text>
    </svg>`;
}
