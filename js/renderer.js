/**
 * js/renderer.js - SVG Renderer with Web Worker support for VGUMap
 * Offloads heavy SVG computation to a Web Worker to prevent UI blocking
 */

// Module-level state for worker management
let svgWorker = null;
let pendingRequestId = 0;
let workerResolve = null;

/**
 * Initialize or get the SVG renderer worker
 * Creates a new worker instance if none exists or if the previous one was terminated
 */
function getSvgWorker() {
  if (!svgWorker) {
    svgWorker = new Worker('./js/workers/svg-renderer.worker.js');
    
    svgWorker.onmessage = function(e) {
      const { svgContent, error } = e.data;
      
      if (workerResolve) {
        const resolve = workerResolve;
        workerResolve = null;
        
        if (error) {
          console.error('❌ Worker error:', error);
          resolve(null);
        } else {
          resolve(svgContent);
        }
      }
    };
    
    svgWorker.onerror = function(e) {
      console.error('❌ Worker script error:', e.message);
      if (workerResolve) {
        const resolve = workerResolve;
        workerResolve = null;
        resolve(null);
      }
    };
  }
  
  return svgWorker;
}

/**
 * Terminate the current worker and cleanup
 * Call this when switching floors rapidly to prevent memory leaks
 */
export function terminateWorker() {
  if (svgWorker) {
    svgWorker.terminate();
    svgWorker = null;
  }
  if (workerResolve) {
    workerResolve = null;
  }
  pendingRequestId++;
}

/**
 * Render SVG from floor data using Web Worker
 * @param {Array} floorData - Filtered array of room segment data for the current floor
 * @param {string} bldInternalId - Building internal ID (e.g., 'bld_ad')
 * @param {string|number} fNum - Floor number
 * @param {string} targetBldCode - Building code (e.g., 'AD', 'LH')
 * @returns {Promise<string|null>} - Complete SVG HTML string or null on error
 */
export async function renderSvgFromWorker(floorData, bldInternalId, fNum, targetBldCode) {
  // Increment request ID to track if this request is still valid
  const currentRequestId = ++pendingRequestId;
  
  const worker = getSvgWorker();
  
  return new Promise((resolve) => {
    workerResolve = resolve;
    
    worker.postMessage({
      floorData,
      bldInternalId,
      fNum,
      targetBldCode
    });
    
    // Safety timeout - if worker takes too long, reject the promise
    setTimeout(() => {
      if (workerResolve && pendingRequestId === currentRequestId) {
        console.warn('⚠️ Worker timed out after 15s');
        const resolve = workerResolve;
        workerResolve = null;
        resolve(null);
      }
    }, 15000);
  });
}

/**
 * Check if the worker is available and ready
 * @returns {boolean}
 */
export function isWorkerReady() {
  return svgWorker !== null;
}
