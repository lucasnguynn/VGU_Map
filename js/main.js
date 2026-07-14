/**
 * VGU Map - Hologram Drill-Down Engine
 * Vanilla JavaScript + Three.js Implementation
 * 
 * STATE MACHINE FLOW:
 * 1. CAMPUS VIEW → Click Building → Show Floor Selector
 * 2. FLOOR SELECTOR → Click Floor → Enter FLOOR VIEW
 * 3. FLOOR VIEW → Click Room → Show Room Info Panel
 * 4. BACK NAVIGATION → Return to Campus View
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

const COLORS = {
    VGU_ORANGE: 0xF37021,
    CYBER_CYAN: 0x06B6D4,
    DARK_BG: 0x070A12,
    WHITE: 0xFFFFFF
};

const CONFIG = {
    BUILDING_HEIGHT: 15,
    HOLOGRAM_OPACITY: 0.15,
    WIREFRAME_OPACITY: 0.8,
    SCALE_FACTOR: 0.01,
    CAMERA_ZOOM_FLOOR: 200,
    CAMERA_ZOOM_CAMPUS: 800
};

// ============================================================================
// APPLICATION STATE (State Machine)
// ============================================================================

/**
 * AppState controls the entire drill-down flow
 * view: 'CAMPUS' | 'FLOOR'
 * building: null | buildingId (e.g., 'cluster-2')
 * floor: null | floorNumber (e.g., 1, 2, 3)
 */
const AppState = {
    view: 'CAMPUS',
    building: null,
    floor: null,
    selectedRoom: null
};

// Global Three.js objects
let scene, camera, renderer, controls;
let mapGroup; // Main group for all map meshes - cleared on state changes
let raycaster, mouse;

// Data stores
let campusBuildingsData = null;
let floorsConfigData = null;
let infoData = null;
let currentFloorData = null;

// Interaction state
let clickableObjects = [];
let highlightedObject = null;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function updateLoading(progress, text) {
    const bar = document.getElementById('loading-bar');
    const textEl = document.getElementById('loading-text');
    if (bar) bar.style.width = `${progress}%`;
    if (textEl) textEl.textContent = text;
}

function hideLoading() {
    const screen = document.getElementById('loading-screen');
    if (screen) {
        screen.style.opacity = '0';
        setTimeout(() => screen.remove(), 500);
    }
}

function calculateBounds(coordinates) {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    coordinates.forEach(coord => {
        minX = Math.min(minX, coord[0]);
        maxX = Math.max(maxX, coord[0]);
        minY = Math.min(minY, coord[1]);
        maxY = Math.max(maxY, coord[1]);
    });
    
    return {
        minX, maxX, minY, maxY,
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2
    };
}

function normalizeCoordinates(coords, bounds, scaleFactor = CONFIG.SCALE_FACTOR) {
    return coords.map(coord => [
        (coord[0] - bounds.centerX) * scaleFactor,
        (coord[1] - bounds.centerY) * scaleFactor
    ]);
}

// ============================================================================
// DATA LOADING
// ============================================================================

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

async function initializeData() {
    updateLoading(10, 'Loading campus buildings...');
    campusBuildingsData = await loadJSON('./campus-buildings.json');
    
    updateLoading(30, 'Loading floor configurations...');
    floorsConfigData = await loadJSON('./floors-config.json');
    
    updateLoading(60, 'Loading facility information...');
    infoData = await loadJSON('./info_data.json');
    
    updateLoading(100, 'Initializing 3D engine...');
    return true;
}

// ============================================================================
// THREE.JS SCENE SETUP
// ============================================================================

function initThreeJS() {
    const container = document.getElementById('canvas-container');
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.DARK_BG);
    scene.fog = new THREE.FogExp2(COLORS.DARK_BG, 0.0005);
    
    mapGroup = new THREE.Group();
    scene.add(mapGroup);
    
    const aspect = container.clientWidth / container.clientHeight;
    const frustumSize = CONFIG.CAMERA_ZOOM_CAMPUS;
    
    camera = new THREE.OrthographicCamera(
        -frustumSize * aspect / 2,
        frustumSize * aspect / 2,
        frustumSize / 2,
        -frustumSize / 2,
        1,
        5000
    );
    camera.position.set(0, 300, 0);
    camera.lookAt(0, 0, 0);
    
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(COLORS.DARK_BG, 1);
    container.appendChild(renderer.domElement);
    
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = true;
    controls.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE
    };
    controls.maxPolarAngle = Math.PI / 2.2;
    controls.minPolarAngle = 0;
    
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    
    const gridHelper = new THREE.GridHelper(1000, 50, COLORS.CYBER_CYAN, 0x112244);
    gridHelper.position.y = -0.5;
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.3;
    scene.add(gridHelper);
    
    window.addEventListener('resize', onWindowResize);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    
    animate();
}

function onWindowResize() {
    const container = document.getElementById('canvas-container');
    const aspect = container.clientWidth / container.clientHeight;
    const frustumSize = AppState.view === 'CAMPUS' ? CONFIG.CAMERA_ZOOM_CAMPUS : CONFIG.CAMERA_ZOOM_FLOOR;
    
    camera.left = -frustumSize * aspect / 2;
    camera.right = frustumSize * aspect / 2;
    camera.top = frustumSize / 2;
    camera.bottom = -frustumSize / 2;
    camera.updateProjectionMatrix();
    
    renderer.setSize(container.clientWidth, container.clientHeight);
}

// ============================================================================
// STEP 1: CAMPUS VIEW
// ============================================================================

async function renderCampusView() {
    mapGroup.clear();
    clickableObjects = [];
    
    updateLoading(80, 'Rendering campus buildings...');
    
    const features = campusBuildingsData.features;
    
    const allCoords = [];
    features.forEach(feature => {
        const coords = feature.geometry.coordinates[0][0];
        allCoords.push(...coords);
    });
    
    const campusBounds = calculateBounds(allCoords);
    
    features.forEach(feature => {
        const buildingId = feature.properties.building_id;
        const buildingName = feature.properties.name;
        const height = feature.properties.height || CONFIG.BUILDING_HEIGHT;
        
        const coords = feature.geometry.coordinates[0][0];
        const normalizedCoords = normalizeCoordinates(coords, campusBounds, 0.5);
        
        const shape = new THREE.Shape();
        normalizedCoords.forEach((coord, index) => {
            if (index === 0) {
                shape.moveTo(coord[0], coord[1]);
            } else {
                shape.lineTo(coord[0], coord[1]);
            }
        });
        shape.closePath();
        
        const extrudeSettings = { depth: height, bevelEnabled: false };
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        
        const material = new THREE.MeshPhongMaterial({
            color: COLORS.CYBER_CYAN,
            transparent: true,
            opacity: CONFIG.HOLOGRAM_OPACITY,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        
        const wireframeMaterial = new THREE.LineBasicMaterial({
            color: COLORS.CYBER_CYAN,
            transparent: true,
            opacity: CONFIG.WIREFRAME_OPACITY
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = 0;
        
        const edgesGeometry = new THREE.EdgesGeometry(geometry);
        const wireframe = new THREE.LineSegments(edgesGeometry, wireframeMaterial);
        wireframe.position.copy(mesh.position);
        
        const buildingGroup = new THREE.Group();
        buildingGroup.add(mesh);
        buildingGroup.add(wireframe);
        
        buildingGroup.userData = {
            type: 'building',
            id: buildingId,
            name: buildingName
        };
        
        mapGroup.add(buildingGroup);
        clickableObjects.push(buildingGroup);
    });
    
    fitCameraToSelection(CONFIG.CAMERA_ZOOM_CAMPUS);
    updateUIForCampusView();
}

// ============================================================================
// STEP 2: BUILDING SELECTION & FLOOR MENU
// ============================================================================

function onBuildingSelected(buildingGroup) {
    const buildingId = buildingGroup.userData.id;
    const buildingName = buildingGroup.userData.name;
    
    AppState.building = buildingId;
    
    highlightObject(buildingGroup, COLORS.VGU_ORANGE);
    
    const floors = floorsConfigData[buildingId] || [];
    
    if (floors.length === 0) {
        console.warn(`[UI] No floors configured for building ${buildingId}`);
        return;
    }
    
    showFloorSelector(buildingName, floors);
}

function showFloorSelector(buildingName, floors) {
    const selector = document.getElementById('floor-selector');
    const nameEl = document.getElementById('selected-building-name');
    const container = document.getElementById('floor-buttons-container');
    
    nameEl.textContent = buildingName;
    container.innerHTML = '';
    
    floors.forEach(floorNum => {
        const btn = document.createElement('button');
        btn.className = 'floor-btn w-full text-left p-3 rounded text-xs font-mono text-cyberCyan hover:text-white transition-all border border-cyberCyan/20 mb-1';
        btn.textContent = `FLOOR ${floorNum}`;
        btn.onclick = () => onFloorSelected(floorNum);
        container.appendChild(btn);
    });
    
    selector.classList.remove('-translate-x-full');
}

function hideFloorSelector() {
    const selector = document.getElementById('floor-selector');
    selector.classList.add('-translate-x-full');
}

// ============================================================================
// STEP 3: FLOOR VIEW (CAD COORDINATES)
// ============================================================================

async function onFloorSelected(floorNum) {
    AppState.floor = floorNum;
    AppState.view = 'FLOOR';
    
    hideFloorSelector();
    updateUIForFloorView(AppState.building, floorNum);
    await renderFloorView(floorNum);
}

async function renderFloorView(floorNum) {
    mapGroup.clear();
    clickableObjects = [];
    
    const floorFile = `./msi-floor${floorNum}.json`;
    
    try {
        updateLoading(50, `Loading Floor ${floorNum} data...`);
        const floorData = await loadJSON(floorFile);
        currentFloorData = floorData;
        
        const features = floorData.features || [];
        
        if (features.length === 0) {
            console.warn(`[RENDER] No room data in ${floorFile}`);
            return;
        }
        
        const allCoords = [];
        features.forEach(feature => {
            const coords = feature.geometry.coordinates[0][0];
            allCoords.push(...coords);
        });
        
        const floorBounds = calculateBounds(allCoords);
        
        features.forEach(feature => {
            const roomId = feature.properties.room_id;
            const roomName = feature.properties.name || 'Unknown Room';
            const roomType = feature.properties.type || 'room';
            
            const coords = feature.geometry.coordinates[0][0];
            const normalizedCoords = normalizeCoordinates(coords, floorBounds, 1.5);
            
            const shape = new THREE.Shape();
            normalizedCoords.forEach((coord, index) => {
                if (index === 0) {
                    shape.moveTo(coord[0], coord[1]);
                } else {
                    shape.lineTo(coord[0], coord[1]);
                }
            });
            shape.closePath();
            
            const geometry = new THREE.ShapeGeometry(shape);
            
            const material = new THREE.MeshBasicMaterial({
                color: COLORS.CYBER_CYAN,
                transparent: true,
                opacity: 0.08,
                side: THREE.DoubleSide
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.y = 0;
            
            const edgesGeometry = new THREE.EdgesGeometry(geometry);
            const wireframeMaterial = new THREE.LineBasicMaterial({
                color: COLORS.CYBER_CYAN,
                transparent: true,
                opacity: 0.9
            });
            const wireframe = new THREE.LineSegments(edgesGeometry, wireframeMaterial);
            wireframe.rotation.x = -Math.PI / 2;
            wireframe.position.y = 0.1;
            
            const clickPlaneGeo = new THREE.ShapeGeometry(shape);
            const clickPlaneMat = new THREE.MeshBasicMaterial({
                visible: false,
                side: THREE.DoubleSide
            });
            const clickPlane = new THREE.Mesh(clickPlaneGeo, clickPlaneMat);
            clickPlane.rotation.x = -Math.PI / 2;
            clickPlane.position.y = 0;
            
            const roomGroup = new THREE.Group();
            roomGroup.add(clickPlane);
            roomGroup.add(mesh);
            roomGroup.add(wireframe);
            
            roomGroup.userData = {
                type: 'room',
                id: roomId,
                name: roomName,
                roomType: roomType
            };
            
            mapGroup.add(roomGroup);
            clickableObjects.push(roomGroup);
        });
        
        fitCameraToSelection(CONFIG.CAMERA_ZOOM_FLOOR);
        updateLoading(100, 'Floor plan ready');
        
    } catch (error) {
        console.error(`[ERROR] Failed to load floor ${floorNum}:`, error);
        alert(`Failed to load Floor ${floorNum} data.`);
        goToCampusView();
    }
}

// ============================================================================
// STEP 4: ROOM SELECTION & INFO PANEL
// ============================================================================

function onRoomSelected(roomGroup) {
    const roomId = roomGroup.userData.id;
    
    AppState.selectedRoom = roomId;
    
    highlightObject(roomGroup, COLORS.VGU_ORANGE);
    displayRoomInfo(roomId);
}

function displayRoomInfo(roomId) {
    const panel = document.getElementById('info-panel');
    const content = document.getElementById('panel-content');
    
    const roomData = infoData.data?.find(r => r.room_number === roomId);
    
    let html = `<h2 class="text-3xl font-bold text-vguOrange mb-1 font-mono">${roomId}</h2>`;
    
    if (roomData) {
        html += `
            <p class="text-xs text-cyberCyan tracking-widest mb-6 uppercase border-b border-cyberCyan/30 pb-2">
                ${roomData.department || 'GENERAL FACILITY'}
            </p>
            <div class="space-y-4">
                <div class="bg-white/5 p-4 rounded-lg border border-white/10 shadow-inner">
                    <span class="text-[10px] text-white/50 uppercase tracking-widest block mb-1">Room Type</span>
                    <span class="text-sm font-bold text-white">${roomData.heading_1 || roomData.fm_room_type || 'N/A'}</span>
                </div>
                <div class="bg-white/5 p-4 rounded-lg border border-white/10 shadow-inner">
                    <span class="text-[10px] text-white/50 uppercase tracking-widest block mb-1">Status</span>
                    <span class="text-sm ${roomData.status === 'active' ? 'text-green-400' : 'text-yellow-400'}">
                        ${(roomData.status || 'Active').toUpperCase()}
                    </span>
                </div>
                <div class="bg-white/5 p-4 rounded-lg border border-white/10 shadow-inner">
                    <span class="text-[10px] text-white/50 uppercase tracking-widest block mb-1">Capacity</span>
                    <span class="text-sm text-white">${roomData.capacity || 'N/A'} persons</span>
                </div>
                <div class="bg-white/5 p-4 rounded-lg border border-white/10 shadow-inner">
                    <span class="text-[10px] text-white/50 uppercase tracking-widest block mb-1">Area</span>
                    <span class="text-sm text-white">${roomData.area || 'N/A'} m²</span>
                </div>
                ${roomData.occupant_display ? `
                <div class="bg-white/5 p-4 rounded-lg border border-white/10 shadow-inner">
                    <span class="text-[10px] text-white/50 uppercase tracking-widest block mb-1">Occupants</span>
                    <p class="text-sm text-white leading-relaxed">${roomData.occupant_display}</p>
                </div>
                ` : ''}
            </div>
        `;
    } else {
        html += `
            <p class="text-white/50 mt-4 text-sm">No detailed information available.</p>
            <p class="text-cyberCyan/70 text-xs mt-2">Room ID: ${roomId}</p>
        `;
    }
    
    content.innerHTML = html;
    panel.classList.remove('translate-y-full', 'md:translate-x-full');
}

function closeInfoPanel() {
    const panel = document.getElementById('info-panel');
    panel.classList.add('translate-y-full', 'md:translate-x-full');
    
    if (highlightedObject) {
        resetHighlight(highlightedObject);
        highlightedObject = null;
    }
    
    AppState.selectedRoom = null;
}

// ============================================================================
// STEP 5: BACK NAVIGATION
// ============================================================================

function goToCampusView() {
    AppState.view = 'CAMPUS';
    AppState.building = null;
    AppState.floor = null;
    AppState.selectedRoom = null;
    
    hideFloorSelector();
    closeInfoPanel();
    updateUIForCampusView();
    renderCampusView();
}

// ============================================================================
// UI MANAGEMENT
// ============================================================================

function updateUIForCampusView() {
    const navBar = document.getElementById('nav-bar');
    const viewIndicator = document.getElementById('view-indicator');
    const viewText = document.getElementById('current-view-text');
    
    navBar.classList.add('hidden');
    viewIndicator.classList.remove('hidden');
    viewText.textContent = 'CAMPUS VIEW';
}

function updateUIForFloorView(buildingId, floorNum) {
    const navBar = document.getElementById('nav-bar');
    const viewIndicator = document.getElementById('view-indicator');
    const breadcrumbBuilding = document.getElementById('breadcrumb-building');
    const breadcrumb = document.getElementById('breadcrumb');
    
    navBar.classList.remove('hidden');
    viewIndicator.classList.add('hidden');
    breadcrumb.classList.remove('hidden');
    breadcrumbBuilding.textContent = `${buildingId.toUpperCase()} - FLOOR ${floorNum}`;
}

// ============================================================================
// INTERACTION HANDLERS
// ============================================================================

function onPointerDown(event) {
    if (event.target.closest('#info-panel') || 
        event.target.closest('#floor-selector') || 
        event.target.closest('header') ||
        event.target.closest('#nav-bar')) {
        return;
    }
    
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    
    const intersects = raycaster.intersectObjects(clickableObjects, true);
    
    if (intersects.length > 0) {
        let object = intersects[0].object;
        while (object.parent && !object.userData.type) {
            object = object.parent;
        }
        
        if (object.userData.type === 'building') {
            onBuildingSelected(object);
        } else if (object.userData.type === 'room') {
            onRoomSelected(object);
        }
    } else {
        if (AppState.selectedRoom) {
            closeInfoPanel();
        }
    }
}

function onPointerMove(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(clickableObjects, true);
    
    renderer.domElement.style.cursor = 'default';
    
    if (intersects.length > 0) {
        renderer.domElement.style.cursor = 'pointer';
    }
}

function highlightObject(group, colorHex) {
    if (highlightedObject && highlightedObject !== group) {
        resetHighlight(highlightedObject);
    }
    
    highlightedObject = group;
    
    group.traverse(child => {
        if (child.isLineSegments) {
            child.material.color.setHex(colorHex);
        }
        if (child.isMesh && child.material.opacity !== undefined) {
            child.material.opacity = Math.min(child.material.opacity + 0.2, 0.5);
        }
    });
}

function resetHighlight(group) {
    group.traverse(child => {
        if (child.isLineSegments) {
            child.material.color.setHex(COLORS.CYBER_CYAN);
        }
        if (child.isMesh && child.material.opacity !== undefined) {
            if (group.userData.type === 'building') {
                child.material.opacity = CONFIG.HOLOGRAM_OPACITY;
            } else {
                child.material.opacity = 0.08;
            }
        }
    });
}

function fitCameraToSelection(zoomLevel) {
    if (clickableObjects.length === 0) return;
    
    const box = new THREE.Box3();
    clickableObjects.forEach(obj => {
        box.expandByObject(obj);
    });
    
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    camera.position.set(center.x, 300, center.z);
    controls.target.copy(center);
    controls.update();
    
    const aspect = renderer.domElement.clientWidth / renderer.domElement.clientHeight;
    const frustumSize = zoomLevel;
    
    camera.left = -frustumSize * aspect / 2;
    camera.right = frustumSize * aspect / 2;
    camera.top = frustumSize / 2;
    camera.bottom = -frustumSize / 2;
    camera.updateProjectionMatrix();
}

// ============================================================================
// ANIMATION LOOP
// ============================================================================

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

async function init() {
    try {
        initThreeJS();
        await initializeData();
        
        document.getElementById('btn-back-campus').addEventListener('click', goToCampusView);
        document.getElementById('btn-close-panel').addEventListener('click', closeInfoPanel);
        
        await renderCampusView();
        hideLoading();
        
        console.log('[INIT] VGU Hologram Map initialized successfully');
        console.log('[STATE] Current view:', AppState.view);
        
    } catch (error) {
        console.error('[INIT] Fatal error:', error);
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.innerHTML = `
                <div class="text-vguOrange text-xl">INITIALIZATION FAILED</div>
                <div class="text-white/50 text-sm mt-2">${error.message}</div>
                <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-cyberCyan text-darkBg rounded text-sm font-bold">RETRY</button>
            `;
        }
    }
}

init();
