
import { FloorPlan, MapZone, MapCameraPlacement, ActiveTrack } from '../types';

const STORAGE_KEY_MAP = 'sentinel_area_map_v61';

const DEFAULT_MAP: FloorPlan = {
    id: 'MAP-001',
    name: '4 Sotix, 7 Xona Uylar Loyihasi N61',
    imageUrl: 'https://i.ytimg.com/vi/uE0W_1tqHCo/maxresdefault.jpg', // YouTube thumbnail for N61 layout
    width: 1000,
    height: 600,
    scale: 25, // 25 pixels = 1 meter
    zones: [
        { 
            id: 'Z-ROAD', 
            name: "Tashqi Ko'cha (Main Street)", 
            type: 'entrance', 
            color: '#1e293b', 
            points: [{x: 0, y: 0}, {x: 200, y: 0}, {x: 200, y: 600}, {x: 0, y: 600}] 
        },
        { 
            id: 'Z-YARD', 
            name: "Asosiy Hovli (Courtyard)", 
            type: 'safe', 
            color: '#cbd5e1', 
            points: [{x: 200, y: 20}, {x: 500, y: 20}, {x: 500, y: 580}, {x: 200, y: 580}] 
        },
        { 
            id: 'Z-LAWN1', 
            name: "Yashil Maydon (Garden Lawn with Pine Trees)", 
            type: 'safe', 
            color: '#16a34a', 
            points: [{x: 230, y: 60}, {x: 480, y: 60}, {x: 480, y: 240}, {x: 230, y: 240}] 
        },
        { 
            id: 'Z-LAWN2', 
            name: "Yashil Maydon (Lower Garden)", 
            type: 'safe', 
            color: '#16a34a', 
            points: [{x: 380, y: 340}, {x: 480, y: 340}, {x: 480, y: 560}, {x: 380, y: 560}] 
        },
        { 
            id: 'Z-GARAGE', 
            name: "Avtoturargoh (Garage with Vehicle)", 
            type: 'safe', 
            color: '#475569', 
            points: [{x: 200, y: 420}, {x: 360, y: 420}, {x: 360, y: 580}, {x: 200, y: 580}] 
        },
        { 
            id: 'Z-R1', 
            name: "Mehmonxona (Guest Salon / Living Room)", 
            type: 'restricted', 
            color: '#3b82f6', 
            points: [{x: 500, y: 40}, {x: 650, y: 40}, {x: 650, y: 220}, {x: 500, y: 220}] 
        },
        { 
            id: 'Z-R2', 
            name: "Oshxona (Kitchen)", 
            type: 'safe', 
            color: '#f59e0b', 
            points: [{x: 650, y: 40}, {x: 780, y: 40}, {x: 780, y: 220}, {x: 650, y: 220}] 
        },
        { 
            id: 'Z-R3', 
            name: "Yuvinish xonasi (Bathroom)", 
            type: 'safe', 
            color: '#06b6d4', 
            points: [{x: 780, y: 40}, {x: 840, y: 40}, {x: 840, y: 220}, {x: 780, y: 220}] 
        },
        { 
            id: 'Z-R4', 
            name: "Bolalar yotoqxonasi (Children Room)", 
            type: 'restricted', 
            color: '#a855f7', 
            points: [{x: 840, y: 40}, {x: 960, y: 40}, {x: 960, y: 220}, {x: 840, y: 220}] 
        },
        { 
            id: 'Z-CORR', 
            name: "Yo'lak (Main Corridor)", 
            type: 'restricted', 
            color: '#64748b', 
            points: [{x: 500, y: 220}, {x: 960, y: 220}, {x: 960, y: 280}, {x: 500, y: 280}] 
        },
        { 
            id: 'Z-R5', 
            name: "Ota-onalar yotoqxonasi (Master Bedroom)", 
            type: 'restricted', 
            color: '#ec4899', 
            points: [{x: 500, y: 280}, {x: 650, y: 280}, {x: 650, y: 480}, {x: 500, y: 480}] 
        },
        { 
            id: 'Z-R6', 
            name: "Mehmonlar yotoqxonasi (Guest Room)", 
            type: 'safe', 
            color: '#10b981', 
            points: [{x: 650, y: 280}, {x: 800, y: 280}, {x: 800, y: 480}, {x: 650, y: 480}] 
        },
        { 
            id: 'Z-R7', 
            name: "Kutubxona / Kabinet (Study Room)", 
            type: 'restricted', 
            color: '#14b8a6', 
            points: [{x: 800, y: 280}, {x: 960, y: 280}, {x: 960, y: 480}, {x: 800, y: 480}] 
        }
    ],
    walls: [
        // Outer Fences (Tashqi devorlar)
        { id: 'W_OUT_TOP', x1: 200, y1: 20, x2: 980, y2: 20 },
        { id: 'W_OUT_RIGHT', x1: 980, y1: 20, x2: 980, y2: 580 },
        { id: 'W_OUT_BOTTOM', x1: 200, y1: 580, x2: 980, y2: 580 },
        { id: 'W_OUT_LEFT_1', x1: 200, y1: 20, x2: 200, y2: 420 },
        { id: 'W_OUT_LEFT_2', x1: 200, y1: 520, x2: 200, y2: 580 },
        { id: 'W_OUT_GATE', x1: 200, y1: 420, x2: 200, y2: 520, height: 1.2 }, // Lower height iron gate

        // Garage (Avtoturargoh)
        { id: 'W_GAR_TOP', x1: 200, y1: 420, x2: 360, y2: 420 },
        { id: 'W_GAR_RIGHT', x1: 360, y1: 420, x2: 360, y2: 580 },

        // House Perimeter (Bino tashqi devorlari)
        { id: 'W_H_TOP', x1: 500, y1: 40, x2: 960, y2: 40 },
        { id: 'W_H_RIGHT', x1: 960, y1: 40, x2: 960, y2: 480 },
        { id: 'W_H_BOTTOM', x1: 500, y1: 480, x2: 960, y2: 480 },
        { id: 'W_H_LEFT_TOP', x1: 500, y1: 40, x2: 500, y2: 220 },
        { id: 'W_H_LEFT_BOTTOM', x1: 500, y1: 280, x2: 500, y2: 480 },

        // Corridor Entrance glass doors / porch
        { id: 'W_H_REC_TOP', x1: 500, y1: 220, x2: 520, y2: 220 },
        { id: 'W_H_REC_BOT', x1: 500, y1: 280, x2: 520, y2: 280 },
        { id: 'W_H_REC_BACK', x1: 520, y1: 220, x2: 520, y2: 280 },

        // Horizontal partition wall above Corridor
        { id: 'W_INT_TOP_CORR', x1: 520, y1: 220, x2: 960, y2: 220 },
        // Horizontal partition wall below Corridor
        { id: 'W_INT_BOT_CORR', x1: 520, y1: 280, x2: 960, y2: 280 },

        // Internal walls for top row rooms
        { id: 'W_INT_R1_R2', x1: 650, y1: 40, x2: 650, y2: 220 },
        { id: 'W_INT_R2_R3', x1: 780, y1: 40, x2: 780, y2: 220 },
        { id: 'W_INT_R3_R4', x1: 840, y1: 40, x2: 840, y2: 220 },

        // Internal walls for bottom row rooms
        { id: 'W_INT_R5_R6', x1: 650, y1: 280, x2: 650, y2: 480 },
        { id: 'W_INT_R6_R7', x1: 800, y1: 280, x2: 800, y2: 480 }
    ],
    cameras: [
        { cameraId: 'CAM-01', x: 210, y: 410, rotation: 120, height: 2.5, pitch: -15 }, // Gate
        { cameraId: 'CAM-02', x: 210, y: 40, rotation: 45, height: 2.8, pitch: -10 },  // Courtyard
        { cameraId: 'CAM-03', x: 490, y: 250, rotation: 180, height: 2.6, pitch: -15 }, // Entrance porch steps
        { cameraId: 'CAM-04', x: 660, y: 50, rotation: 135, height: 2.5, pitch: -20 },  // Inside Kitchen
        { cameraId: 'CAM-05', x: 510, y: 230, rotation: 0, height: 2.4, pitch: -10 },   // Corridor
        { cameraId: 'CAM-06', x: 950, y: 30, rotation: 225, height: 2.8, pitch: -25 },  // East side wall
        { cameraId: 'CAM-07', x: 950, y: 530, rotation: 315, height: 2.8, pitch: -25 }  // South side wall
    ]
};

// Simulation State (Module Level)
interface SimAgent {
    id: string;
    name: string;
    role: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    path: {x: number, y: number, timestamp: number}[];
}

let activeAgents: SimAgent[] = [];

const initAgents = () => {
    activeAgents = [
        { id: 'TRK-001', name: 'Admin User', role: 'ADMIN', x: 100, y: 500, vx: 2, vy: -1, path: [] },
        { id: 'TRK-002', name: 'John Doe', role: 'EMPLOYEE', x: 400, y: 300, vx: -1.5, vy: 0.5, path: [] },
        { id: 'TRK-003', name: 'Unknown', role: 'UNKNOWN', x: 700, y: 100, vx: -0.5, vy: 1, path: [] },
        { id: 'TRK-004', name: 'Jane Smith', role: 'OPERATOR', x: 300, y: 200, vx: 1, vy: 1, path: [] }
    ];
};

export const mapService = {
    getMap: (): FloorPlan => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY_MAP);
            if (!stored || stored === "undefined") return DEFAULT_MAP;
            return JSON.parse(stored);
        } catch (e) {
            return DEFAULT_MAP;
        }
    },

    saveMap: (map: FloorPlan) => {
        localStorage.setItem(STORAGE_KEY_MAP, JSON.stringify(map));
    },

    // Simulates fetching live trajectories from backend. No fake tracks allowed.
    getLiveTracks: (cameras: MapCameraPlacement[]): Promise<ActiveTrack[]> => {
        return Promise.resolve([]);
    }
};
