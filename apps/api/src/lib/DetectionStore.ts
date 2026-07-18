export type BoundingBox = {
    id: string | number;
    x: number; // Source X
    y: number; // Source Y
    w: number; // Source Width
    h: number; // Source Height
    label: string;
    confidence: number;
    color?: string;
    vx?: number;
    vy?: number;
    crossed?: boolean;
};

export type Heatpoint = {
    id: number;
    x: number;
    y: number;
    age: number;
};

export type CameraDetectionState = {
    objects: BoundingBox[];
    heatpoints: Heatpoint[];
    inCount: number;
    outCount: number;
    tripwireActive: boolean;
    sourceWidth: number;
    sourceHeight: number;
    inferenceTime: number;
    fps: number;
    engineActive: boolean;
};

class SharedDetectionStore {
    private state: Record<string, CameraDetectionState> = {};

    set(cameraId: string, update: Partial<CameraDetectionState>) {
        if (!this.state[cameraId]) {
            this.state[cameraId] = { 
                objects: [], 
                heatpoints: [], 
                inCount: 0, 
                outCount: 0, 
                tripwireActive: false, 
                sourceWidth: 640, 
                sourceHeight: 480,
                inferenceTime: 0,
                fps: 0,
                engineActive: false
            };
        }
        this.state[cameraId] = { ...this.state[cameraId], ...update };
    }

    get(cameraId: string): CameraDetectionState {
        return this.state[cameraId] || { 
            objects: [], 
            heatpoints: [], 
            inCount: 0, 
            outCount: 0, 
            tripwireActive: false, 
            sourceWidth: 640, 
            sourceHeight: 480,
            inferenceTime: 0,
            fps: 0,
            engineActive: false
        };
    }
}

export const detectionStore = new SharedDetectionStore();
