// ==========================================
// 1. HÀM CHÍNH: ĐÓN NHẬN REQUEST VÀ TRẢ DỮ LIỆU
// ==========================================
function doGet(e) {
  const cache = CacheService.getScriptCache();
  // Đổi cacheKey để ép Google vứt bỏ bản cache lỗi đang bị kẹt
  const cacheKey = "vgu_rooms_api_data_v2"; 
  
  // Chấp nhận cả tham số nocache hoặc nếu sync truyền v thì cũng cân nhắc bỏ qua cache
  const forceRefresh = e && e.parameter && (e.parameter.nocache === "true" || e.parameter.force === "1");
  
  if (!forceRefresh) {
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return ContentService.createTextOutput(cachedData).setMimeType(ContentService.MimeType.JSON);
    }
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets();
    const roomsMap = {};

    sheets.forEach(sheet => {
      const sheetName = sheet.getName();
      const normalizedSheetName = normalizeHeader(sheetName);

      if (normalizedSheetName.includes("danh_sach_nhan_vien") || normalizedSheetName.includes("nhan_vien") || normalizedSheetName.includes("staff") || normalizedSheetName.includes("employee") || normalizedSheetName.includes("hanh_chinh")) {
        return;
      }

      const data = sheet.getDataRange().getValues();
      if (!data || data.length < 2) return;

      const headerRowIndex = detectHeaderRowIndex(data);
      if (headerRowIndex < 0 || headerRowIndex >= data.length - 1) return;

      const normalizedHeaders = buildNormalizedHeaders(data[headerRowIndex]);

      for (let i = headerRowIndex + 1; i < data.length; i++) {
        const row = data[i];
        if (isBlankRow(row)) continue;

        const rowData = toRowObject(row, normalizedHeaders);
        const roomNumber = getFirstString(rowData, ["number", "room_number", "ma_phong", "so_phong", "room_code", "room"]);

        if (!roomNumber || roomNumber.toLowerCase().includes("total")) continue;

        if (!roomsMap[roomNumber]) {
          roomsMap[roomNumber] = {
            sheet_source: sheetName,
            room_number: roomNumber,
            heading_1: getFirstString(rowData, ["name", "heading_1", "ten", "ten_phong"], "___"),
            heading_2: getFirstString(rowData, ["ten_phong", "heading_2", "name"], "___"),
            department: getFirstString(rowData, ["department", "phong_ban", "bo_phan"], "___"),
            occupants_list: [],
            fm_room_function: getFirstString(rowData, ["fm_room_function", "function", "chuc_nang"], "___"),
            fm_room_type: getFirstString(rowData, ["fm_room_type", "type", "loai_phong", "loai"], "___"),
            area: getSafeNumberText(rowData, ["area", "room_area", "dien_tich"], "--"),
            unbounded_height: getSafeNumberText(rowData, ["unbounded_height", "height", "chieu_cao"], "--"),
            capacity: getSafeNumberText(rowData, ["capacity", "suc_chua"], "--"),
            status: getFirstString(rowData, ["status", "trang_thai"], "Chưa cập nhật") 
          };
        }

        const occupant = getFirstString(rowData, ["occupant", "nguoi_su_dung", "staff_name", "fm_staff_name", "nhan_su"], "");
        if (occupant && roomsMap[roomNumber].occupants_list.indexOf(occupant) === -1) {
          roomsMap[roomNumber].occupants_list.push(occupant);
        }

        const statusVal = getFirstString(rowData, ["status", "trang_thai"], "");
        if (statusVal) roomsMap[roomNumber].status = statusVal;
      }
    });

    const resultData = Object.keys(roomsMap).map(roomKey => {
      const room = roomsMap[roomKey];
      room.occupant_display = room.occupants_list.join(", ");
      delete room.occupants_list; 
      return room;
    });

    // CHỐT CHẶN QUAN TRỌNG: Nếu mảng rỗng, ném lỗi ra ngoài, TUYỆT ĐỐI KHÔNG CACHE.
    if (resultData.length === 0) {
      throw new Error("Dữ liệu rỗng. Không tìm thấy cột thông tin phòng trong Sheets.");
    }

    const responsePayload = JSON.stringify({
      status: "success",
      total_rooms: resultData.length,
      last_updated: new Date().toISOString(),
      data: resultData
    });

    // 🚀 BỌC BẢO VỆ: Chống sập API khi dữ liệu vượt quá 100KB của CacheService
    try {
      cache.put(cacheKey, responsePayload, 900);
    } catch (cacheError) {
      // Nếu Google chê data quá bự ("Argument too large"), ta lờ đi và bỏ qua việc lưu cache.
      // API vẫn tiếp tục chạy và trả về dữ liệu thành công!
    }

    return ContentService.createTextOutput(responsePayload).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
        status: "error", message: String(error), data: []
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ==========================================
// 2. CÁC HÀM BỔ TRỢ (HELPER FUNCTIONS) KÈM THEO
// ==========================================

function normalizeHeader(str) {
  if (!str) return "";
  return str.toString().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Khử dấu tiếng Việt
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-z0-9]/g, "_")                    // Thay ký tự đặc biệt bằng "_"
    .replace(/_+/g, "_")                           // Gom nhiều dấu "_" liên tiếp
    .replace(/^_+|_+$/g, "");                      // Cắt dấu "_" ở đầu/cuối
}

function detectHeaderRowIndex(data) {
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    for (let j = 0; j < row.length; j++) {
      const cellClean = normalizeHeader(row[j]);
      // Kiểm tra nếu hàng chứa một trong các từ khóa cột phòng phổ biến
      if (["number", "room_number", "ma_phong", "so_phong", "room"].indexOf(cellClean) !== -1) {
        return i;
      }
    }
  }
  return 0; // Mặc định dòng đầu tiên nếu không tự nhận diện được
}

function buildNormalizedHeaders(headerRow) {
  return headerRow.map(cell => normalizeHeader(cell));
}

function isBlankRow(row) {
  return row.every(cell => cell === "" || cell === null || cell === undefined);
}

function toRowObject(row, normalizedHeaders) {
  const obj = {};
  normalizedHeaders.forEach((header, index) => {
    if (header) {
      obj[header] = row[index];
    }
  });
  return obj;
}

function getFirstString(rowData, keys, defaultValue) {
  const fallback = defaultValue !== undefined ? defaultValue : "";
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (rowData[key] !== undefined && rowData[key] !== null && rowData[key] !== "") {
      return rowData[key].toString().trim();
    }
  }
  return fallback;
}

function getSafeNumberText(rowData, keys, defaultValue) {
  const fallback = defaultValue !== undefined ? defaultValue : "--";
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (rowData[key] !== undefined && rowData[key] !== null && rowData[key] !== "") {
      return rowData[key].toString().trim();
    }
  }
  return fallback;
}
