function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets();
    const roomsMap = {};

    sheets.forEach(sheet => {
      const sheetName = sheet.getName();
      const normalizedSheetName = normalizeHeader(sheetName);

      // Always skip employee list sheets.
      if (normalizedSheetName.includes("danh_sach_nhan_vien")) return;

      const data = sheet.getDataRange().getValues();
      if (!data || data.length === 0) return;

      const headerRowIndex = detectHeaderRowIndex(data);
      if (headerRowIndex < 0 || headerRowIndex >= data.length - 1) return;

      const normalizedHeaders = buildNormalizedHeaders(data[headerRowIndex]);

      for (let i = headerRowIndex + 1; i < data.length; i++) {
        const row = data[i];
        if (isBlankRow(row)) continue;

        const rowData = toRowObject(row, normalizedHeaders);

        const roomNumber = getFirstString(rowData, [
          "number",
          "room_number",
          "room_number_",
          "ma_phong",
          "so_phong"
        ]);

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
            fm_room_type: getFirstString(rowData, ["fm_room_type", "type", "loai"], "___"),
            fm_building_code: getFirstString(rowData, ["fm_room_buildingcode", "building_code", "toa_nha"], ""),
            area: getSafeNumberText(rowData, ["area", "room_area"], "--"),
            unbounded_height: getSafeNumberText(rowData, ["unbounded_height", "height"], "--"),
            capacity: getSafeNumberText(rowData, ["capacity", "suc_chua"], "0"),
            raw_status: getFirstString(rowData, ["status", "trang_thai"], "")
          };
        }

        const occupant = getFirstString(rowData, ["occupant", "nhan_su", "nguoi_su_dung"], "");
        if (occupant && roomsMap[roomNumber].occupants_list.indexOf(occupant) === -1) {
          roomsMap[roomNumber].occupants_list.push(occupant);
        }

        const statusVal = getFirstString(rowData, ["status", "trang_thai"], "");
        if (statusVal) roomsMap[roomNumber].raw_status = statusVal;
      }
    });

    const resultData = Object.keys(roomsMap).map(roomKey => {
      const room = roomsMap[roomKey];
      const rawStatus = String(room.raw_status || "").toLowerCase();
      const roomType = String(room.fm_room_type || "").toLowerCase();
      const roomFunc = String(room.fm_room_function || "").toLowerCase();

      let statusText = "Hoạt động";
      if (rawStatus.includes("operational")) {
        statusText = "Hoạt động";
      } else if (
        rawStatus.includes("at-rest") ||
        rawStatus.includes("maintenance") ||
        roomType.includes("repair") ||
        roomFunc.includes("sửa chữa")
      ) {
        statusText = "Bảo trì";
      } else if (
        rawStatus.includes("out of order") ||
        roomType.includes("vacant") ||
        roomFunc.includes("unassigned")
      ) {
        statusText = "Không hoạt động";
      } else if (roomType.includes("vacant") || roomFunc.includes("unassigned")) {
        statusText = "Không hoạt động";
      }

      room.status = statusText;
      room.is_active = statusText !== "Không hoạt động";

      if (!room.fm_building_code && room.room_number.indexOf("-") > -1) {
        room.fm_building_code = room.room_number.split("-")[0].toUpperCase();
      }

      delete room.raw_status;
      return room;
    });

    return jsonResponse({
      status: "success",
      total_rooms: resultData.length,
      last_updated: new Date().toISOString(),
      data: resultData
    });
  } catch (error) {
    return jsonResponse({
      status: "error",
      message: (error && error.message) ? error.message : String(error),
      last_updated: new Date().toISOString(),
      data: []
    });
  }
}

// Normalize headers: lowercase, trim, remove accents, replace non-alnum with underscores.
function normalizeHeader(header) {
  const text = (header === null || header === undefined) ? "" : String(header);
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildNormalizedHeaders(headerRow) {
  return headerRow.map((cell, idx) => {
    const normalized = normalizeHeader(cell);
    return normalized || ("col_" + idx);
  });
}

function toRowObject(row, normalizedHeaders) {
  const obj = {};
  normalizedHeaders.forEach((key, idx) => {
    if (key) obj[key] = row[idx];
  });
  return obj;
}

function getFirstString(rowData, keys, fallback) {
  for (let i = 0; i < keys.length; i++) {
    const val = rowData[keys[i]];
    if (val !== null && val !== undefined) {
      const text = String(val).trim();
      if (text) return text;
    }
  }
  return fallback || "";
}

function getSafeNumberText(rowData, keys, fallback) {
  for (let i = 0; i < keys.length; i++) {
    const val = rowData[keys[i]];
    if (val === null || val === undefined || String(val).trim() === "") continue;

    if (typeof val === "number") return String(val);

    const text = String(val).trim();
    const parsed = parseFloat(text.toString().replace(/,/g, ""));
    if (!isNaN(parsed)) return String(parsed);
    return text;
  }
  return fallback;
}

function isBlankRow(row) {
  return !row || row.every(cell => cell === "" || cell === null || cell === undefined);
}

function detectHeaderRowIndex(data) {
  // Prefer a row containing known header signals; fallback to first non-blank row.
  const signals = ["number", "room_number", "name", "department", "status", "area", "capacity"];
  const scanLimit = Math.min(data.length, 10);

  for (let i = 0; i < scanLimit; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const normalizedRow = row.map(normalizeHeader);
    const score = signals.reduce((acc, signal) => acc + (normalizedRow.indexOf(signal) > -1 ? 1 : 0), 0);
    if (score >= 2) return i;
  }

  for (let j = 0; j < scanLimit; j++) {
    if (!isBlankRow(data[j])) return j;
  }

  return -1;
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
