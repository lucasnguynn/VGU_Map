import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- BIẾN TOÀN CỤC ---
let scene, camera, renderer, controls;
let roomObjects = []; // Mảng chứa các khối 3D để Raycaster kiểm tra
let currentHighlighted = null;
let facilitiesData = null; // Dữ liệu từ info_data.json

// Hàm khởi tạo chính
async function init() {
    setupThreeJS();
    await loadDataAndBuildMap();
    setupInteractions();
    animate();
    
    // Tắt màn hình loading
    document.getElementById('loading-screen').style.opacity = '0';
    setTimeout(() => document.getElementById('loading-screen').remove(), 500);
}

// 1. Cấu hình Three.js (Môi trường Hologram)
function setupThreeJS() {
    const container = document.getElementById('canvas-container');
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070A12); // Nền tối
    scene.fog = new THREE.FogExp2(0x070A12, 0.0015); // Sương mù mờ ảo

    // Thêm Lưới Bàn Cờ phong cách Cyberpunk làm sàn
    const gridHelper = new THREE.GridHelper(2000, 100, 0x06B6D4, 0x112244);
    gridHelper.position.y = -1;
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.2;
    scene.add(gridHelper);

    // Camera Orthographic (Góc nhìn Blueprint phẳng)
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 400; // Độ zoom khởi tạo
    camera = new THREE.OrthographicCamera(
        frustumSize * aspect / -2, frustumSize * aspect / 2,
        frustumSize / 2, frustumSize / -2,
        1, 10000
    );
    // Đặt camera nhìn từ trên cao, hơi nghiêng nhẹ
    camera.position.set(0, 500, 0); 
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableRotate = false; // Khóa xoay 3D để giữ nguyên cảm giác Map 2D
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Resize event
    window.addEventListener('resize', onWindowResize);
}

// 2. Tải Dữ liệu và Xây Dựng Bản Đồ
async function loadDataAndBuildMap() {
    try {
        // Tải 2 file JSON
        const [mapRes, infoRes] = await Promise.all([
            fetch('map_data.json'),
            fetch('info_data.json')
        ]);
        
        const mapData = await mapRes.json();
        const infoDataPayload = await infoRes.json();
        // Lấy array data từ info_data.json
        facilitiesData = infoDataPayload.data || [];

        // BƯỚC QUAN TRỌNG: Tính toán dời tâm tọa độ khổng lồ về (0,0)
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        
        // Gom nhóm các đoạn thẳng theo từng phòng
        const roomsMap = {};
        
        mapData.forEach(segment => {
            // Tính toán Bounding Box tổng
            minX = Math.min(minX, segment.StartX, segment.EndX);
            maxX = Math.max(maxX, segment.StartX, segment.EndX);
            minY = Math.min(minY, segment.StartY, segment.EndY);
            maxY = Math.max(maxY, segment.StartY, segment.EndY);

            if (!roomsMap[segment.Room_Number]) roomsMap[segment.Room_Number] = [];
            roomsMap[segment.Room_Number].push(segment);
        });

        // Tọa độ trung tâm của toàn bộ khu vực
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        // Hệ số thu nhỏ (Do tọa độ hệ mét lên tới hàng trăm ngàn)
        const scaleFactor = 0.01; 

        // Vẽ từng phòng
        for (const [roomId, segments] of Object.entries(roomsMap)) {
            const group = new THREE.Group();
            group.userData = { roomId: roomId };

            // Vật liệu phát sáng viền Hologram
            const lineMat = new THREE.LineBasicMaterial({ color: 0x06B6D4, transparent: true, opacity: 0.8 });
            const geometry = new THREE.BufferGeometry();
            const vertices = [];

            // Biến tính Bounding Box riêng cho MỖI PHÒNG để làm mặt phẳng Click
            let rMinX = Infinity, rMaxX = -Infinity, rMinZ = Infinity, rMaxZ = -Infinity;

            segments.forEach(seg => {
                // Quy đổi tọa độ: Đưa về tâm (0,0) và thu nhỏ
                const x1 = (seg.StartX - centerX) * scaleFactor;
                const z1 = -(seg.StartY - centerY) * scaleFactor; // Trục Y trong CAD là trục Z trong 3D
                const x2 = (seg.EndX - centerX) * scaleFactor;
                const z2 = -(seg.EndY - centerY) * scaleFactor;

                vertices.push(x1, 0, z1);
                vertices.push(x2, 0, z2);

                rMinX = Math.min(rMinX, x1, x2);
                rMaxX = Math.max(rMaxX, x1, x2);
                rMinZ = Math.min(rMinZ, z1, z2);
                rMaxZ = Math.max(rMaxZ, z1, z2);
            });

            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            const lines = new THREE.LineSegments(geometry, lineMat);
            group.add(lines);

            // Tạo một mặt phẳng mờ ảo (Mesh) vừa khít phòng để dễ Click
            const width = rMaxX - rMinX;
            const height = rMaxZ - rMinZ;
            if (width > 0 && height > 0) {
                const planeGeo = new THREE.PlaneGeometry(width, height);
                // Nền kính mờ
                const planeMat = new THREE.MeshBasicMaterial({ color: 0x06B6D4, transparent: true, opacity: 0.05, side: THREE.DoubleSide });
                const plane = new THREE.Mesh(planeGeo, planeMat);
                plane.rotation.x = -Math.PI / 2; // Đặt nằm ngang
                plane.position.set(rMinX + width / 2, 0, rMinZ + height / 2);
                
                group.add(plane);
            }

            scene.add(group);
            roomObjects.push(group); // Đưa vào mảng để bắt sự kiện Click
        }

    } catch (error) {
        console.error("Lỗi khi load dữ liệu map:", error);
    }
}

// 3. Xử lý tương tác Chuột & UI
function setupInteractions() {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Xử lý Click trên Map
    window.addEventListener('pointerdown', (event) => {
        // Bỏ qua nếu click vào UI (Header, Info Panel)
        if(event.target.closest('#info-panel') || event.target.closest('header')) return;

        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        
        // Kiểm tra xem tia laser có cắt qua mặt phẳng ẩn của phòng nào không
        const intersects = raycaster.intersectObjects(roomObjects, true);

        if (intersects.length > 0) {
            // Truy ngược lên Group cha để lấy ID phòng
            let object = intersects[0].object;
            while(object.parent && object.parent.type === 'Group') {
                object = object.parent;
            }
            
            const roomId = object.userData.roomId;
            highlightRoom(object);
            showRoomDataUI(roomId);
        } else {
            // Click ra ngoài khoảng trống -> Đóng UI
            closePanel();
        }
    });

    // Nút đóng UI
    document.getElementById('btn-close').addEventListener('click', closePanel);
}

// Hàm Highlight khối phòng bằng Màu VGU Orange
function highlightRoom(group) {
    if (currentHighlighted) {
        // Trả màu lại như cũ
        currentHighlighted.children.forEach(child => {
            if (child.isLineSegments) child.material.color.setHex(0x06B6D4);
            if (child.isMesh) child.material.opacity = 0.05;
        });
    }
    currentHighlighted = group;
    // Đổi sang màu cam VGU
    group.children.forEach(child => {
        if (child.isLineSegments) child.material.color.setHex(0xF37021); // Cam VGU
        if (child.isMesh) child.material.opacity = 0.3; // Làm sáng nền lên
    });
}

// Hàm Render dữ liệu nghiệp vụ ra UI
function showRoomDataUI(roomId) {
    const panel = document.getElementById('info-panel');
    const content = document.getElementById('panel-content');
    
    // Tìm phòng trong info_data.json
    const roomData = facilitiesData ? facilitiesData.find(r => r.room_number === roomId) : null;

    let htmlHTML = `<h2 class="text-3xl font-bold text-vguOrange mb-1 font-mono">${roomId}</h2>`;
    
    if (roomData) {
        htmlHTML += `
            <p class="text-xs text-cyberCyan tracking-widest mb-6 uppercase border-b border-cyberCyan/30 pb-2">${roomData.department || 'GENERAL EDUCATION'}</p>
            
            <div class="space-y-4">
                <div class="bg-white/5 p-4 rounded-lg border border-white/10 shadow-inner">
                    <span class="text-[10px] text-white/50 uppercase tracking-widest block mb-1">Status</span>
                    <span class="text-sm font-bold ${roomData.status === 'active' ? 'text-green-400' : 'text-yellow-400'}">${(roomData.status || 'Active').toUpperCase()}</span>
                </div>

                <div class="bg-white/5 p-4 rounded-lg border border-white/10 shadow-inner">
                    <span class="text-[10px] text-white/50 uppercase tracking-widest block mb-1">Type & Capacity</span>
                    <span class="text-sm text-white">${roomData.heading_1 || 'Room'} - ${roomData.capacity || 'N/A'} pax</span>
                </div>

                <div class="bg-white/5 p-4 rounded-lg border border-white/10 shadow-inner">
                    <span class="text-[10px] text-white/50 uppercase tracking-widest block mb-1">Occupants</span>
                    <p class="text-sm text-white leading-relaxed">${roomData.occupant_display || 'No occupants registered'}</p>
                </div>
            </div>
        `;
    } else {
        htmlHTML += `<p class="text-white/50 mt-4 text-sm">NO DATA FOUND IN DATABASE.</p>`;
    }

    content.innerHTML = htmlHTML;
    
    // Kích hoạt animation trượt bảng UI ra
    panel.classList.remove('translate-y-full', 'md:translate-x-full');
}

function closePanel() {
    document.getElementById('info-panel').classList.add('translate-y-full', 'md:translate-x-full');
    if (currentHighlighted) {
        currentHighlighted.children.forEach(child => {
            if (child.isLineSegments) child.material.color.setHex(0x06B6D4);
            if (child.isMesh) child.material.opacity = 0.05;
        });
        currentHighlighted = null;
    }
}

// 4. Vòng lặp Render (Game Loop)
function animate() {
    requestAnimationFrame(animate);
    controls.update(); // Mượt mà hóa thao tác di chuyển
    renderer.render(scene, camera);
}

function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 400;
    
    camera.left = -frustumSize * aspect / 2;
    camera.right = frustumSize * aspect / 2;
    camera.top = frustumSize / 2;
    camera.bottom = -frustumSize / 2;
    camera.updateProjectionMatrix();
    
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Khởi động ứng dụng
init();
