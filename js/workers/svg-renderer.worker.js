/**
 * js/workers/svg-renderer.worker.js
 * Web Worker for off-main-thread SVG rendering computation
 * 
 * Input (via postMessage): floorData array with building/floor context
 * Output (via postMessage): Complete SVG HTML string or null on error
 */

self.onmessage = function(e) {
  try {
    const { floorData, bldInternalId, fNum, targetBldCode } = e.data;
    
    if (!floorData || floorData.length === 0) {
      self.postMessage({ svgContent: null });
      return;
    }
    
    const floorPrefix = `${targetBldCode}-${fNum}`;
    
    // ── AD BUILDING ONLY: Coordinate outlier filter for Floors 5-6 ──
    const isADBuilding = (bldInternalId === 'bld_ad');
    const isADFloor5or6 = isADBuilding && (parseInt(fNum) === 5 || parseInt(fNum) === 6);
    
    // ── STEP 2: Calculate bounding box EXCLUSIVELY from floorData (per-floor bounds) ──
    let floorMinX = Infinity, floorMinY = Infinity;
    let floorMaxX = -Infinity, floorMaxY = -Infinity;
    
    floorData.forEach(d => {
      let sx = parseFloat(d.StartX) || 0, sy = parseFloat(d.StartY) || 0;
      let ex = parseFloat(d.EndX) || 0, ey = parseFloat(d.EndY) || 0;
      
      // Filter out rogue/outlier coordinates (skip segments where both start coords are 0)
      if (d.StartX == 0 && d.StartY == 0) return;
      
      // ── AD Floors 5-6 ONLY: Filter out erroneous outlier coordinates ──
      // These floors have bad data with coords far outside the true cluster bounding box
      if (isADFloor5or6) {
        // For AD-5/6, valid X range is roughly -60000 to -25000, Y range is ~234000 to ~277000
        // Skip segments that are vastly outside this expected cluster
        const ad56ValidMinX = -70000, ad56ValidMaxX = -20000;
        const ad56ValidMinY = 230000, ad56ValidMaxY = 280000;
        
        if (sx < ad56ValidMinX || sx > ad56ValidMaxX || ex < ad56ValidMinX || ex > ad56ValidMaxX) return;
        if (sy < ad56ValidMinY || sy > ad56ValidMaxY || ey < ad56ValidMinY || ey > ad56ValidMaxY) return;
      }
      
      floorMinX = Math.min(floorMinX, sx, ex);
      floorMaxX = Math.max(floorMaxX, sx, ex);
      floorMinY = Math.min(floorMinY, sy, ey);
      floorMaxY = Math.max(floorMaxY, sy, ey);
    });
    
    if (floorData.length === 0) {
      self.postMessage({ svgContent: null });
      return;
    }
    
    let bldWidth = floorMaxX - floorMinX;
    let bldHeight = floorMaxY - floorMinY;
    
    let padX = bldWidth * 0.05;
    let padY = bldHeight * 0.05;
    
    let paddedWidth = bldWidth + padX * 2;
    let paddedHeight = bldHeight + padY * 2;
    
    let vbW = 1000;
    let uniformScale = vbW / paddedWidth;
    let vbH = paddedHeight * uniformScale;
    
    function mapX(realX) {
      return (realX - floorMinX + padX) * uniformScale;
    }
    function mapY(realY) {
      return (floorMaxY - realY + padY) * uniformScale;
    }
    
    const rooms = {};
    floorData.forEach(d => {
      const rNumStr = d.Room_Number || d.room_number || d['Room_Number'] || d['room_number'] || "";
      let rNum = String(rNumStr).trim();
      if (!rooms[rNum]) {
        rooms[rNum] = { paths: [], minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
      }
      let sx = parseFloat(d.StartX) || 0, sy = parseFloat(d.StartY) || 0;
      let ex = parseFloat(d.EndX) || 0, ey = parseFloat(d.EndY) || 0;
      
      // ── AD Floors 5-6 ONLY: Apply same coordinate filter when building room paths ──
      if (isADFloor5or6) {
        const ad56ValidMinX = -70000, ad56ValidMaxX = -20000;
        const ad56ValidMinY = 230000, ad56ValidMaxY = 280000;
        
        if (sx < ad56ValidMinX || sx > ad56ValidMaxX || ex < ad56ValidMinX || ex > ad56ValidMaxX) return;
        if (sy < ad56ValidMinY || sy > ad56ValidMaxY || ey < ad56ValidMinY || ey > ad56ValidMaxY) return;
      }
      
      rooms[rNum].paths.push({sx, sy, ex, ey});
      rooms[rNum].minX = Math.min(rooms[rNum].minX, sx, ex);
      rooms[rNum].maxX = Math.max(rooms[rNum].maxX, sx, ex);
      rooms[rNum].minY = Math.min(rooms[rNum].minY, sy, ey);
      rooms[rNum].maxY = Math.max(rooms[rNum].maxY, sy, ey);
    });
    
    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH.toFixed(2)}" width="${vbW}" height="${vbH.toFixed(2)}" style="display:block">
      <rect x="0" y="0" width="${vbW}" height="${vbH}" fill="#eef2f9"/>`;
    
    const backgroundLayer = [];
    const interactiveLayer = [];
    
    const BCAT = {'AD-501':'large','AD-507':'large','AD-201':'hall','AD-247':'large','AD-248':'large','AD-251':'large','AD-101':'large','AD-601':'large','AD-609':'large','AD-614':'large'};
    
    for (const [roomNum, rData] of Object.entries(rooms)) {
      let dString = "", lastX = null, lastY = null;
      rData.paths.forEach(p => {
        if (lastX === null || Math.abs(p.sx - lastX) > 0.1 || Math.abs(p.sy - lastY) > 0.1) {
          dString += `M ${mapX(p.sx).toFixed(2)} ${mapY(p.sy).toFixed(2)} `;
        }
        dString += `L ${mapX(p.ex).toFixed(2)} ${mapY(p.ey).toFixed(2)} `;
        lastX = p.ex; lastY = p.ey;
      });
      dString += "Z";
      
      let textX = mapX((rData.minX + rData.maxX) / 2);
      let textY = mapY((rData.minY + rData.maxY) / 2);
      let roomWidth = Math.abs(mapX(rData.maxX) - mapX(rData.minX));
      let roomHeight = Math.abs(mapY(rData.minY) - mapY(rData.maxY));
      
      let baseFontSize = vbW * 0.008;
      let maxFontByWidth = roomWidth / Math.max(roomNum.length * 0.65, 1);
      let maxFontByHeight = roomHeight * 0.45;
      let fontSize = Math.max(Math.min(baseFontSize, maxFontByWidth, maxFontByHeight), 2);
      let strokeW = Math.max(vbW * 0.0008, 0.4);
      
      const isBackground = /^(LB|CR|WC)/i.test(roomNum);
      
      let fillColor = "#e8edf8", strokeColor = "#7a8fb8";
      if (/^WC/i.test(roomNum)) {
        fillColor = "#c5e3f0"; strokeColor = "#3d7a99";
      } else if (/^(LB|CR)/i.test(roomNum)) {
        fillColor = "#dce1f2"; strokeColor = "#6b7aa8";
      } else if (BCAT[roomNum] || roomNum.includes("Hội trường")) {
        fillColor = "#dff0e6"; strokeColor = "#3a7a5a";
      }
      
      if (isBackground) {
        backgroundLayer.push(`\n        <g style="cursor:default">\n          <path d="${dString}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeW}" pointer-events="none">\n            <title>${roomNum}</title>\n          </path>\n          <text x="${textX.toFixed(2)}" y="${textY.toFixed(2)}" text-anchor="middle" dominant-baseline="middle" font-family="IBM Plex Sans,sans-serif" font-size="${fontSize.toFixed(2)}" font-weight="600" fill="#8896a8" pointer-events="none" style="paint-order:stroke;stroke:#ffffff;stroke-width:${fontSize * 0.25}px">${roomNum}</text>\n        </g>`);
      } else {
        interactiveLayer.push(`\n        <g onclick="rC('${roomNum}')" style="cursor:pointer">\n          <path d="${dString}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeW}">\n            <title>${roomNum}</title>\n          </path>\n          <text x="${textX.toFixed(2)}" y="${textY.toFixed(2)}" text-anchor="middle" dominant-baseline="middle" font-family="IBM Plex Sans,sans-serif" font-size="${fontSize.toFixed(2)}" font-weight="600" fill="#002554" pointer-events="none" style="paint-order:stroke;stroke:#ffffff;stroke-width:${fontSize * 0.25}px">${roomNum}</text>\n        </g>`);
      }
    }
    
    svgContent += backgroundLayer.join('') + interactiveLayer.join('');
    const resultSvg = svgContent + `</svg>`;
    
    self.postMessage({ svgContent: resultSvg });
    
  } catch (e) {
    console.error("❌ Worker error in SVG rendering:", e);
    self.postMessage({ svgContent: null, error: e.message });
  }
};
