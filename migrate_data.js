// migrate_data.js
const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, 'info_data.json');
const labsOutputDir = path.join(__dirname, 'content', 'labs');
const equipOutputDir = path.join(__dirname, 'content', 'equipment');

// Tạo thư mục nếu chưa có
[labsOutputDir, equipOutputDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const rawData = fs.readFileSync(inputPath, 'utf8');
const parsedData = JSON.parse(rawData);
const rooms = parsedData.data || parsedData;

console.log(`Đang xử lý ${rooms.length} phòng...`);

rooms.forEach(room => {
    // Chỉ lấy mã phòng thực tế (ví dụ: AD-207)
    const roomId = room.room_number.replace(/\s+/g, '-').toUpperCase();
    
    // Trích xuất số tầng từ mã phòng (VD: AD-207 -> Tầng 2, 3.CR5 -> Tầng 3)
    let floor = 1;
    const match = roomId.match(/(?:AD-|B3-)?(\d)\d{2}/) || roomId.match(/^(\d)\./);
    if (match) floor = parseInt(match[1]);

    const mdContent = `---
room_id: "${roomId}"
name: "${(room.heading_1 || 'Unknown') + (room.heading_2 ? ' - ' + room.heading_2 : '')}"
building_id: "${room.sheet_source || 'UNKNOWN'}"
floor: ${floor}
departments: 
  - "${room.department || 'General'}"
head_of_lab:
  name: "${room.occupant_display || 'Chưa cập nhật'}"
  email: "contact@vgu.edu.vn"
  office: "${roomId}"
status: "${room.status === ' ang s ng' ? 'operational' : 'maintenance'}"
highlighted_equipment: []
vr_panorama: ""
---

Trang thông tin không gian kiến trúc cho khu vực **${room.heading_1}**.
Hệ thống cảm biến và dữ liệu telemetry đang được đồng bộ.
`;

    // Ghi file cho từng Lab
    fs.writeFileSync(path.join(labsOutputDir, `${roomId}.md`), mdContent);
});

// Tạo một file máy móc giả định (Dummy Equipment) để test hiệu ứng X-Ray
const dummyEquip = `---
id: "spectrometer-01"
title: "Máy Quang Phổ Kế Chân Không"
model: "V-SPEC 9000"
manufacturer: "TechCorp"
departments: ["Chemistry"]
location:
  building_id: "AD"
  floor: 2
  room_id: "AD-247"
  station_id: "ST-01"
media:
  images: ["/images/machine-exterior.jpg"]
  internal_blueprint: "/images/machine-blueprint.svg"
  ambient_color: "#00ffcc"
status: "operational"
category: "Phân tích cấu trúc"
---

::equipment-story
Khi chùm tia laser đi qua lăng kính, hệ thống từ trường sẽ đo lường độ tán xạ, cung cấp dữ liệu vi mô chính xác tuyệt đối.
::
`;
fs.writeFileSync(path.join(equipOutputDir, `spectrometer-01.md`), dummyEquip);

console.log('✅ Hoàn tất chuyển đổi! Dữ liệu đã sẵn sàng cho Nuxt Content.');