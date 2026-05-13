/**
 * VGUMap Room Data API - doGet Function
 * 
 * This script acts as a JSON API endpoint for Google Sheets room data.
 * It is bulletproof against human data-entry errors in sheet headers.
 * 
 * Features:
 * - Header normalization (lowercase, trim whitespace, replace spaces with underscores)
 * - Safe mapping using normalized keys
 * - Data type safety (numbers rounded to 2 decimal places)
 * - Groups occupants into occupants_list array
 * - Skips "Danh sách nhân viên" sheet
 * - Status categorization logic preserved
 * 
 * Deployment:
 * 1. Copy this code to Google Apps Script editor
 * 2. Deploy as Web App with "Anyone can access" permission
 * 3. Use the deployment URL as your API endpoint
 */

function doGet(e) {
  try {
    // Get the active spreadsheet
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheets = ss.getSheets();
    
    var allRooms = [];
    
    // Iterate through all sheets except "Danh sách nhân viên"
    for (var i = 0; i < sheets.length; i++) {
      var sheet = sheets[i];
      var sheetName = sheet.getName();
      
      // Skip the "Danh sách nhân viên" sheet
      if (sheetName.toLowerCase() === 'danh sách nhân viên' || 
          sheetName.toLowerCase() === 'nhanh vien' ||
          sheetName.toLowerCase().includes('staff')) {
        continue;
      }
      
      // Get all data from the sheet
      var data = sheet.getDataRange().getValues();
      
      // Skip if no data or less than 2 rows (need header + at least 1 data row)
      if (data.length < 2) {
        continue;
      }
      
      // ═══════════════════════════════════════════════════════════
      // HEADER NORMALIZATION
      // Convert headers to lowercase, trim whitespace, replace spaces with underscores
      // ═══════════════════════════════════════════════════════════
      var rawHeaders = data[0]; // First row contains headers
      var normalizedHeaders = [];
      var headerIndexMap = {};
      
      for (var h = 0; h < rawHeaders.length; h++) {
        var header = rawHeaders[h];
        
        // Handle null/undefined headers
        if (header === null || header === undefined) {
          header = '';
        }
        
        // Normalize: lowercase, trim, replace multiple spaces/special chars with single underscore
        var normalized = String(header)
          .toLowerCase()
          .trim()
          .replace(/\s+/g, '_')           // Replace multiple spaces with single underscore
          .replace(/[:\.\/\\\-]+/g, '_')  // Replace colons, dots, slashes, backslashes, dashes with underscore
          .replace(/_+/g, '_')            // Replace multiple underscores with single underscore
          .replace(/^_|_$/g, '');         // Remove leading/trailing underscores
        
        normalizedHeaders.push(normalized);
        headerIndexMap[normalized] = h;
      }
      
      // Helper function to get value by normalized key
      function getValueByNormalizedKey(rowData, headers, indexMap, key) {
        var normalizedKey = String(key)
          .toLowerCase()
          .trim()
          .replace(/\s+/g, '_')
          .replace(/[:\.\/\\\-]+/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '');
        
        var idx = indexMap[normalizedKey];
        if (idx !== undefined && idx < rowData.length) {
          return rowData[idx];
        }
        return null;
      }
      
      // Helper function to safely convert value to string with number formatting
      function safeToString(value, maxDecimals) {
        if (value === null || value === undefined || value === '') {
          return '';
        }
        
        // Check if it's a number
        if (typeof value === 'number') {
          if (maxDecimals !== undefined) {
            // Round to specified decimal places
            return parseFloat(value.toFixed(maxDecimals)).toString();
          }
          return value.toString();
        }
        
        // For strings, trim and return
        return String(value).trim();
      }
      
      // Helper function to get numeric value with rounding
      function getNumericValue(value, maxDecimals) {
        if (value === null || value === undefined || value === '') {
          return null;
        }
        
        var num = parseFloat(value);
        if (isNaN(num)) {
          return null;
        }
        
        if (maxDecimals !== undefined) {
          return parseFloat(num.toFixed(maxDecimals));
        }
        return num;
      }
      
      // Process data rows (skip header row)
      for (var r = 1; r < data.length; r++) {
        var rowData = data[r];
        
        // Skip completely empty rows
        var hasData = false;
        for (var c = 0; c < rowData.length; c++) {
          if (rowData[c] !== null && rowData[c] !== undefined && rowData[c] !== '') {
            hasData = true;
            break;
          }
        }
        if (!hasData) {
          continue;
        }
        
        // Extract values using normalized header keys
        var roomNumber = safeToString(getValueByNormalizedKey(rowData, normalizedHeaders, headerIndexMap, 'room_number'));
        var roomName = safeToString(getValueByNormalizedKey(rowData, normalizedHeaders, headerIndexMap, 'room_name'));
        var tenPhong = safeToString(getValueByNormalizedKey(rowData, normalizedHeaders, headerIndexMap, 'ten_phong'));
        var heading1 = safeToString(getValueByNormalizedKey(rowData, normalizedHeaders, headerIndexMap, 'heading_1'));
        var heading2 = safeToString(getValueByNormalizedKey(rowData, normalizedHeaders, headerIndexMap, 'heading_2'));
        var department = safeToString(getValueByNormalizedKey(rowData, normalizedHeaders, headerIndexMap, 'department'));
        var fmRoomFunction = safeToString(getValueByNormalizedKey(rowData, normalizedHeaders, headerIndexMap, 'fm_room_function'));
        var functionField = safeToString(getValueByNormalizedKey(rowData, normalizedHeaders, headerIndexMap, 'function'));
        var fmRoomType = safeToString(getValueByNormalizedKey(rowData, normalizedHeaders, headerIndexMap, 'fm_room_type'));
        var typeField = safeToString(getValueByNormalizedKey(rowData, normalizedHeaders, headerIndexMap, 'type'));
        var area = safeToString(getValueByNormalizedKey(rowData, normalizedHeaders, headerIndexMap, 'area'), 2);
        var capacity = safeToString(getValueByNormalizedKey(rowData, normalizedHeaders, headerIndexMap, 'capacity'), 2);
        var status = safeToString(getValueByNormalizedKey(rowData, normalizedHeaders, headerIndexMap, 'status'));
        var isActive = getValueByNormalizedKey(rowData, normalizedHeaders, headerIndexMap, 'is_active');
        var occupantName = safeToString(getValueByNormalizedKey(rowData, normalizedHeaders, headerIndexMap, 'occupant_name'));
        var staffName = safeToString(getValueByNormalizedKey(rowData, normalizedHeaders, headerIndexMap, 'staff_name'));
        var nameField = safeToString(getValueByNormalizedKey(rowData, normalizedHeaders, headerIndexMap, 'name'));
        var fmBuildingCode = safeToString(getValueByNormalizedKey(rowData, normalizedHeaders, headerIndexMap, 'fm_building_code'));
        var unboundedHeight = safeToString(getValueByNormalizedKey(rowData, normalizedHeaders, headerIndexMap, 'unbounded_height'), 2);
        var equipment = safeToString(getValueByNormalizedKey(rowData, normalizedHeaders, headerIndexMap, 'equipment'));
        var aboundHeight = safeToString(getValueByNormalizedKey(rowData, normalizedHeaders, headerIndexMap, 'abound_height'), 2);
        
        // Use heading_1/heading_2 if room_name not available
        if (!roomName && heading1) {
          roomName = heading1;
        }
        if (!tenPhong && heading2) {
          tenPhong = heading2;
        }
        
        // Determine function (prefer fm_room_function over function field)
        var roomFunction = fmRoomFunction || functionField || '';
        
        // Determine type (prefer fm_room_type over type field)
        var roomType = fmRoomType || typeField || '';
        
        // Process status and isActive
        var processedStatus = status;
        var processedIsActive = isActive;
        
        // Status categorization logic
        if (!processedStatus || processedStatus === '') {
          if (processedIsActive === true || processedIsActive === 'TRUE' || processedIsActive === 'true' || processedIsActive === 1) {
            processedStatus = 'Hoạt động';
          } else if (processedIsActive === false || processedIsActive === 'FALSE' || processedIsActive === 'false' || processedIsActive === 0) {
            processedStatus = 'Không hoạt động';
          } else {
            processedStatus = 'Hoạt động'; // Default to active
          }
        }
        
        // Normalize isActive boolean
        if (processedIsActive === null || processedIsActive === undefined || processedIsActive === '') {
          processedIsActive = (processedStatus === 'Hoạt động');
        } else {
          processedIsActive = (processedIsActive === true || processedIsActive === 'TRUE' || processedIsActive === 'true' || processedIsActive === 1);
        }
        
        // Create room entry
        var roomEntry = {
          sheet_source: sheetName,
          room_number: roomNumber,
          heading_1: roomName || '',
          heading_2: tenPhong || '',
          department: department || '___',
          occupants_list: [],
          fm_room_function: roomFunction || '___',
          fm_room_type: roomType || '',
          fm_building_code: fmBuildingCode || '',
          area: area || '0',
          unbounded_height: unboundedHeight || '',
          capacity: capacity || '--',
          status: processedStatus,
          is_active: processedIsActive,
          equipment: equipment || '',
          abound_height: aboundHeight || ''
        };
        
        // Add occupant name if present
        var currentOccupant = occupantName || staffName || nameField || '';
        
        // Check if this room already exists in allRooms
        var existingRoomIndex = -1;
        for (var er = 0; er < allRooms.length; er++) {
          if (allRooms[er].room_number === roomNumber && allRooms[er].sheet_source === sheetName) {
            existingRoomIndex = er;
            break;
          }
        }
        
        if (existingRoomIndex >= 0) {
          // Room exists, add occupant to occupants_list if not already present
          if (currentOccupant && currentOccupant.trim() !== '') {
            var occupantsList = allRooms[existingRoomIndex].occupants_list;
            if (!occupantsList.includes(currentOccupant)) {
              occupantsList.push(currentOccupant);
            }
          }
          
          // Update other fields if they have better data
          if (roomEntry.department && roomEntry.department !== '___') {
            allRooms[existingRoomIndex].department = roomEntry.department;
          }
          if (roomEntry.fm_room_function && roomEntry.fm_room_function !== '___') {
            allRooms[existingRoomIndex].fm_room_function = roomEntry.fm_room_function;
          }
          if (roomEntry.fm_room_type) {
            allRooms[existingRoomIndex].fm_room_type = roomEntry.fm_room_type;
          }
          if (roomEntry.area && roomEntry.area !== '0') {
            allRooms[existingRoomIndex].area = roomEntry.area;
          }
          if (roomEntry.capacity && roomEntry.capacity !== '--') {
            allRooms[existingRoomIndex].capacity = roomEntry.capacity;
          }
        } else {
          // New room, add occupant if present
          if (currentOccupant && currentOccupant.trim() !== '') {
            roomEntry.occupants_list.push(currentOccupant);
          }
          allRooms.push(roomEntry);
        }
      }
    }
    
    // Build response
    var response = {
      status: 'success',
      total_rooms: allRooms.length,
      last_updated: new Date().toISOString(),
      data: allRooms
    };
    
    // Return JSON response with no-cache headers to prevent Google Apps Script caching
    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      .setHeader('Pragma', 'no-cache')
      .setHeader('Expires', '0');
    
  } catch (error) {
    // Error handling
    var errorResponse = {
      status: 'error',
      message: error.toString(),
      data: []
    };
    
    // Return error response with no-cache headers
    return ContentService
      .createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      .setHeader('Pragma', 'no-cache')
      .setHeader('Expires', '0');
  }
}
