/**
 * VGUMap Configuration
 * Centralized configuration for API endpoints and application settings
 */

// API Endpoints - Google Sheets Apps Script URLs
export const API_ENDPOINTS = {
    MAP_COORDINATES: 'https://script.google.com/macros/s/AKfycbxFmunolmZ5LSC6exu6OnGE0dZi9VYrf6gWBqMJQOrFUe8MdRQAiz0XT825JwkGd-O0/exec',
    ROOM_SCHEDULE: 'https://script.google.com/macros/s/AKfycbzhMONbzVtaRnlIe3hiumaNXBPbQN6qybuANtguLcWMO1ZM0Nmu0NtWZ2yfGsJWORM5dA/exec',
    DRIVE_LIST: 'https://script.google.com/macros/s/AKfycbw4PtDoCILXSiIn1AAYzJhUhSvmJ6ufKD-5R-QKZGzbBy-yQTfC_bPTKJEErwt1d_iS/exec'
};

// Local JSON file paths (for cached data)
export const DATA_FILES = {
    MAP_COORDINATES: './map_data.json',
    ROOM_SCHEDULE: './info_data.json',
    DRIVE_LIST: './drive_data.json'
};

// Cache configuration
export const CACHE_CONFIG = {
    TTL: 5 * 60 * 1000, // 5 minutes in milliseconds
    KEYS: {
        MAP: 'vgu_map_coordinates_cache',
        ROOMS: 'vgu_room_schedule_cache',
        DRIVE: 'vgu_drive_images_cache'
    }
};

// Exclusion filter codes - rooms with these codes will NOT appear in search dropdown
export const EXCLUDED_ROOM_CODES = ['CR', 'LB', 'WC'];

// Building definitions
export const BUILDINGS = [
    { id: 'bld_ad', name: 'Admin Building', active: true, floors: 6 },
    { id: 'bld_lh', name: 'Lecture Hall', active: false, floors: 4 },
    { id: 'bld_c1', name: 'Cluster 1', active: false, floors: 4 },
    { id: 'bld_c2', name: 'Cluster 2', active: false, floors: 4 },
    { id: 'bld_c3', name: 'Cluster 3', active: false, floors: 4 },
    { id: 'bld_c5', name: 'Cluster 5', active: false, floors: 4 },
    { id: 'bld_c6', name: 'Cluster 6', active: false, floors: 4 },
    { id: 'bld_lb', name: 'Library', active: false, floors: 3 },
    { id: 'bld_d1', name: 'Dorm 1', active: false, floors: 8 },
    { id: 'bld_d2', name: 'Dorm 2', active: false, floors: 8 },
    { id: 'bld_ct', name: 'Canteen', active: false, floors: 2 },
    { id: 'bld_gh', name: 'Guest House', active: false, floors: 3 },
    { id: 'bld_ch', name: 'Ceremony Hall', active: false, floors: 2 },
    { id: 'bld_eh', name: 'Exhibition Hall', active: false, floors: 2 },
    { id: 'bld_sh', name: 'Sport Hall', active: false, floors: 2 }
];

// Floor names mapping
export const FLOOR_NAMES = {
    bld_ad: [
        'Tầng 1 — Bãi giữ xe',
        'Tầng 2',
        'Tầng 3',
        'Tầng 4',
        'Tầng 5',
        'Tầng 6'
    ]
};

// Room mappings by building and floor
export const FLOOR_ROOMS = {
    'bld_ad_f1': ['AD-101', 'AD-103', 'AD-104'],
    'bld_ad_f2': [
        'AD-201', 'AD-204', 'AD-205', 'AD-206', 'AD-207', 'AD-211', 'AD-212',
        'AD-213', 'AD-214', 'AD-216', 'AD-217', 'AD-218', 'AD-219', 'AD-220', 'AD-224',
        'AD-226', 'AD-228', 'AD-229', 'AD-230', 'AD-231', 'AD-232', 'AD-234', 'AD-235',
        'AD-236', 'AD-237', 'AD-240', 'AD-241', 'AD-242', 'AD-243', 'AD-244', 'AD-245',
        'AD-246', 'AD-247', 'AD-248', 'AD-249', 'AD-251',
        'AD-2.LB1', 'AD-2.LB2', 'AD-2.LB3', 'AD-2.LB4', 'AD-2.LB5', 'AD-2.LB6', 'AD-2.LB7'
    ],
    'bld_ad_f3': [
        'AD-301', 'AD-304', 'AD-305', 'AD-306', 'AD-307', 'AD-308', 'AD-309', 'AD-310',
        'AD-311', 'AD-312', 'AD-313', 'AD-314', 'AD-315', 'AD-316', 'AD-317', 'AD-318',
        'AD-319', 'AD-320', 'AD-321', 'AD-322', 'AD-323', 'AD-324', 'AD-325', 'AD-326',
        'AD-327', 'AD-328A', 'AD-328B', 'AD-329', 'AD-330', 'AD-331', 'AD-332', 'AD-335',
        'AD-336', 'AD-337', 'AD-338', 'AD-339', 'AD-340', 'AD-341', 'AD-342A', 'AD-342B',
        'AD-343', 'AD-344', 'AD-345', 'AD-346', 'AD-347', 'AD-348', 'AD-349', 'AD-350',
        'AD-351', 'AD-353', 'AD-355', 'AD-356', 'AD-357', 'AD-358', 'AD-359', 'AD-362',
        'AD-363', 'AD-364', 'AD-365', 'AD-366', 'AD-367', 'AD-368', 'AD-369', 'AD-370',
        'AD-371', 'AD-372', 'AD-373', 'AD-376', 'AD-377', 'AD-378', 'AD-379', 'AD-380',
        'AD-381', 'AD-382', 'AD-383', 'AD-384', 'AD-385', 'AD-386', 'AD-387', 'AD-388',
        'AD-389', 'AD-390', 'AD-391'
    ],
    'bld_ad_f4': [
        'AD-401', 'AD-403', 'AD-404', 'AD-405', 'AD-407', 'AD-410', 'AD-411', 'AD-412',
        'AD-414', 'AD-416', 'AD-417', 'AD-418', 'AD-419', 'AD-420', 'AD-422', 'AD-423',
        'AD-424', 'AD-425', 'AD-426', 'AD-427', 'AD-428', 'AD-429', 'AD-430', 'AD-431',
        'AD-432', 'AD-435', 'AD-436', 'AD-437', 'AD-438', 'AD-439', 'AD-440', 'AD-441',
        'AD-442', 'AD-443', 'AD-444', 'AD-446', 'AD-447', 'AD-448', 'AD-449', 'AD-450',
        'AD-451', 'AD-453', 'AD-454', 'AD-455', 'AD-456', 'AD-459', 'AD-460', 'AD-462',
        'AD-463', 'AD-464', 'AD-465', 'AD-466', 'AD-467', 'AD-468', 'AD-469', 'AD-470',
        'AD-471', 'AD-472', 'AD-473', 'AD-474', 'AD-475', 'AD-478', 'AD-479', 'AD-480',
        'AD-481', 'AD-482', 'AD-483', 'AD-484', 'AD-485', 'AD-486', 'AD-487', 'AD-488',
        'AD-489', 'AD-490', 'AD-491', 'AD-492', 'AD-493', 'AD-495'
    ],
    'bld_ad_f5': [
        'AD-501', 'AD-504', 'AD-505', 'AD-507', 'AD-508', 'AD-510', 'AD-511', 'AD-512',
        'AD-513', 'AD-514', 'AD-515', 'AD-516', 'AD-517', 'AD-518', 'AD-519', 'AD-520',
        'AD-522', 'AD-523', 'AD-524'
    ],
    'bld_ad_f6': [
        'AD-601', 'AD-604', 'AD-605', 'AD-608', 'AD-609', 'AD-610',
        'AD-611', 'AD-612', 'AD-613', 'AD-614', 'AD-615', 'AD-616', 'AD-617'
    ]
};

// Room category mappings for styling
export const ROOM_CATEGORIES = {
    'AD-501': 'large', 'AD-507': 'large', 'AD-201': 'hall',
    'AD-247': 'large', 'AD-248': 'large', 'AD-251': 'large',
    'AD-101': 'large', 'AD-601': 'large', 'AD-609': 'large', 'AD-614': 'large'
};

// Color themes for room types
export const ROOM_TYPE_COLORS = {
    office: ['#e8eef9', '#002554'],
    hall: ['#e8edff', '#001060'],
    large: ['#e6f5ec', '#083a18'],
    lb: ['#fff3e6', '#7a4800']
};

// Application state
export const initialState = {
    buildingId: '',
    floorId: '',
    floorNumber: 0,
    floorKey: '',
    roomId: '',
    roomData: null,
    tab: '2D'
};
