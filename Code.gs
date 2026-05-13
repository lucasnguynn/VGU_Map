function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheets = ss.getSheets();
    var allRooms = [];
    var roomIndexMap = Object.create(null);

    for (var i = 0; i < sheets.length; i++) {
      var sheet = sheets[i];
      var sheetName = sheet.getName();
      var normalizedSheetName = normalizeHeader(sheetName);
      if (normalizedSheetName === 'danh_sach_nhan_vien' || normalizedSheetName === 'nhan_vien' || normalizedSheetName.indexOf('staff') !== -1) continue;

      var data = sheet.getDataRange().getValues();
      if (!data || data.length < 2) continue;

      var rawHeaders = data[0];
      var headerIndexMap = Object.create(null);
      for (var h = 0; h < rawHeaders.length; h++) {
        var k = normalizeHeader(rawHeaders[h]);
        if (k && headerIndexMap[k] === undefined) headerIndexMap[k] = h;
      }

      for (var r = 1; r < data.length; r++) {
        var row = data[r];
        if (isEmptyRow(row)) continue;

        var roomNumber = safeToString(getByKey(row, headerIndexMap, 'room_number'));
        if (!roomNumber) continue;

        var roomName = safeToString(getByKey(row, headerIndexMap, 'room_name')) || safeToString(getByKey(row, headerIndexMap, 'heading_1'));
        var heading2 = safeToString(getByKey(row, headerIndexMap, 'ten_phong')) || safeToString(getByKey(row, headerIndexMap, 'heading_2'));
        var department = safeToString(getByKey(row, headerIndexMap, 'department')) || '___';
        var roomFunction = safeToString(getByKey(row, headerIndexMap, 'fm_room_function')) || safeToString(getByKey(row, headerIndexMap, 'function')) || '___';
        var roomType = safeToString(getByKey(row, headerIndexMap, 'fm_room_type')) || safeToString(getByKey(row, headerIndexMap, 'type'));
        var area = safeToString(getByKey(row, headerIndexMap, 'area'), 2) || '0';
        var capacity = safeToString(getByKey(row, headerIndexMap, 'capacity'), 2) || '--';
        var status = safeToString(getByKey(row, headerIndexMap, 'status'));
        var isActiveRaw = getByKey(row, headerIndexMap, 'is_active');
        var occupant = safeToString(getByKey(row, headerIndexMap, 'occupant_name')) || safeToString(getByKey(row, headerIndexMap, 'staff_name')) || safeToString(getByKey(row, headerIndexMap, 'name'));

        var isActive = normalizeBoolean(isActiveRaw);
        if (!status) status = isActive === false ? 'Không hoạt động' : 'Hoạt động';
        if (isActive === null) isActive = status === 'Hoạt động';

        var key = sheetName + '|' + roomNumber;
        var idx = roomIndexMap[key];
        if (idx === undefined) {
          idx = allRooms.length;
          roomIndexMap[key] = idx;
          allRooms.push({
            sheet_source: sheetName,
            room_number: roomNumber,
            heading_1: roomName || '',
            heading_2: heading2 || '',
            department: department,
            occupants_list: [],
            fm_room_function: roomFunction,
            fm_room_type: roomType || '',
            fm_building_code: safeToString(getByKey(row, headerIndexMap, 'fm_building_code')) || '',
            area: area,
            unbounded_height: safeToString(getByKey(row, headerIndexMap, 'unbounded_height'), 2) || '',
            capacity: capacity,
            status: status,
            is_active: isActive,
            equipment: safeToString(getByKey(row, headerIndexMap, 'equipment')) || '',
            abound_height: safeToString(getByKey(row, headerIndexMap, 'abound_height'), 2) || ''
          });
        }

        var room = allRooms[idx];
        if (occupant && room.occupants_list.indexOf(occupant) === -1) room.occupants_list.push(occupant);
        if (room.department === '___' && department !== '___') room.department = department;
        if (room.fm_room_function === '___' && roomFunction !== '___') room.fm_room_function = roomFunction;
        if (!room.fm_room_type && roomType) room.fm_room_type = roomType;
        if (room.area === '0' && area !== '0') room.area = area;
        if (room.capacity === '--' && capacity !== '--') room.capacity = capacity;
      }
    }

    return buildJsonResponse({ status: 'success', total_rooms: allRooms.length, last_updated: new Date().toISOString(), data: allRooms });
  } catch (error) {
    return buildJsonResponse({ status: 'error', message: String(error), data: [] });
  }
}

function normalizeHeader(value) {
  return String(value || '').toLowerCase().trim().replace(/\s+/g, '_').replace(/[:\.\/\\\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}
function getByKey(row, map, key) { var i = map[normalizeHeader(key)]; return i === undefined ? null : row[i]; }
function safeToString(v, dec) { if (v === null || v === undefined || v === '') return ''; if (typeof v === 'number' && dec !== undefined) return String(Number(v.toFixed(dec))); return String(v).trim(); }
function normalizeBoolean(v) { if (v === true || v === 1 || String(v).toLowerCase() === 'true') return true; if (v === false || v === 0 || String(v).toLowerCase() === 'false') return false; return null; }
function isEmptyRow(row) { for (var i = 0; i < row.length; i++) { if (row[i] !== null && row[i] !== undefined && row[i] !== '') return false; } return true; }
function buildJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
    .setHeader('Cache-Control', 'no-cache, no-store, must-revalidate').setHeader('Pragma', 'no-cache').setHeader('Expires', '0');
}
