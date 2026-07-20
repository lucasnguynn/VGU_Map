// migrate_data.js
const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, 'info_data.json');
const driveDataPath = path.join(__dirname, 'drive_data.json');
const labsOutputDir = path.join(__dirname, 'content', 'labs');

// Tạo thư mục nếu chưa có
if (!fs.existsSync(labsOutputDir)) {
    fs.mkdirSync(labsOutputDir, { recursive: true });
}

// Đọc info_data.json
let rooms = [];
if (fs.existsSync(inputPath)) {
    const rawData = fs.readFileSync(inputPath, 'utf8');
    const parsedData = JSON.parse(rawData);
    rooms = parsedData.data || parsedData;
} else {
    console.log('⚠️  File info_data.json không tồn tại. Không có dữ liệu để xử lý.');
    process.exit(0);
}

// Đọc drive_data.json (nếu tồn tại, ngược lại dùng object rỗng)
let driveData = {};
if (fs.existsSync(driveDataPath)) {
    try {
        const driveRaw = fs.readFileSync(driveDataPath, 'utf8');
        driveData = JSON.parse(driveRaw);
    } catch (e) {
        console.log('⚠️  Không thể đọc drive_data.json, sử dụng object rỗng.');
        driveData = {};
    }
}

console.log(`Đang xử lý ${rooms.length} phòng...`);

// Bảng map status ĐÚNG
const STATUS_MAP = {
    'Đang sử dụng': 'operational',
    'Chưa sử dụng': 'vacant',
    'Chưa cập nhật': 'unknown'
};

// Hàm helper convert Drive fileId thành URL ảnh xem trực tiếp
function driveImageUrl(fileId) {
    if (!fileId) return null;
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
}

// Hàm helper escape YAML để tránh ký tự đặc biệt phá cú pháp frontmatter
function yamlSafe(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// Thống kê
let stats = {
    operational: 0,
    vacant: 0,
    unknown: 0,
    withImage: 0
};

rooms.forEach(room => {
    // Chỉ lấy mã phòng thực tế (ví dụ: AD-207)
    const roomId = room.room_number.replace(/\s+/g, '-').toUpperCase();
    
    // Trích xuất số tầng từ mã phòng (VD: AD-207 -> Tầng 2, 3.CR5 -> Tầng 3, B3-517 -> Tầng 5)
    let floor = 1;
    const match = roomId.match(/(?:AD-|B\d-)?(\d)\d{2}/) || roomId.match(/^(\d)\./);
    if (match) floor = parseInt(match[1], 10);

    // Lấy status đúng từ bảng map
    const status = STATUS_MAP[room.status] || 'unknown';
    stats[status]++;

    // Lấy image từ driveData
    const imageId = driveData[roomId];
    const imageUrl = driveImageUrl(imageId);
    if (imageUrl) {
        stats.withImage++;
    }

    const mdContent = `---
room_id: "${yamlSafe(roomId)}"
name: "${yamlSafe((room.heading_1 || 'Unknown') + (room.heading_2 ? ' - ' + room.heading_2 : ''))}"
building_id: "${yamlSafe(room.sheet_source || 'UNKNOWN')}"
floor: ${floor}
departments: 
  - "${yamlSafe(room.department || 'General')}"
room_type: "${yamlSafe(room.fm_room_function || '___')}"
area_m2: "${yamlSafe(room.area || '--')}"
capacity: "${yamlSafe(room.capacity || '--')}"
head_of_lab:
  name: "${yamlSafe(room.occupant_display || 'Chưa cập nhật')}"
  email: "contact@vgu.edu.vn"
  office: "${yamlSafe(roomId)}"
status: "${status}"
highlighted_equipment: []
vr_panorama: ""
image: "${imageUrl || ''}"
---

Trang thông tin không gian kiến trúc cho khu vực **${yamlSafe(room.heading_1 || 'Unknown')}**.
Hệ thống cảm biến và dữ liệu telemetry đang được đồng bộ.
`;

    // Ghi file cho từng Lab
    fs.writeFileSync(path.join(labsOutputDir, `${roomId}.md`), mdContent);
});

// In log thống kê cuối script
console.log('\n✅ Hoàn tất chuyển đổi! Dữ liệu đã sẵn sàng cho Nuxt Content.');
console.log('\n📊 Thống kê:');
console.log(`   - Total rooms: ${rooms.length}`);
console.log(`   - Operational: ${stats.operational}`);
console.log(`   - Vacant: ${stats.vacant}`);
console.log(`   - Unknown: ${stats.unknown}`);
console.log(`   - Rooms with Drive images: ${stats.withImage}`);