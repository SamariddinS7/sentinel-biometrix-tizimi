
import { TrackedFace } from './trackerService';

// WebSocket Protocol Types
type WSMessage = 
  | { type: 'connect', cameraId: string }
  | { type: 'frame', data: Blob }
  | { type: 'result', tracks: TrackedFace[], timestamp: number, heatmap?: any, alerts?: any[] };

export class StreamService {
    private socket: WebSocket | null = null;
    private url: string = 'ws://localhost:8000/ws/live-stream'; 
    private listeners: ((tracks: TrackedFace[], heatmap?: any, alerts?: any[]) => void)[] = [];
    private isConnected: boolean = false;
    
    // Flow Control
    private activeLoop: boolean = false;
    private videoElement: HTMLVideoElement | null = null;
    private canvasElement: HTMLCanvasElement = document.createElement('canvas');
    private lastFrameTime: number = 0;
    private readonly TARGET_FPS = 25; // Cap capture rate
    private readonly FRAME_INTERVAL = 1000 / 25;
    private readonly BACKPRESSURE_THRESHOLD = 1024 * 100; // 100KB buffered limit

    connect(cameraId: string = 'WEBCAM_CLIENT') {
        if (this.socket) return;

        this.socket = new WebSocket(`${this.url}/${cameraId}`);
        this.socket.binaryType = 'arraybuffer';

        this.socket.onopen = () => {
            console.log('Stream Socket Connected');
            this.isConnected = true;
            if (this.activeLoop) this.startStreamingLoop();
        };

        this.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'result') {
                    this.notifyListeners(data.tracks, data.heatmap, data.alerts);
                }
            } catch (e) {
                console.error("Invalid WS Message", e);
            }
        };

        this.socket.onclose = () => {
            console.log('Stream Disconnected');
            this.isConnected = false;
            this.activeLoop = false;
        };

        this.socket.onerror = (err) => console.error('Stream Error', err);
    }

    /**
     * Registers the video source and starts the capture loop.
     */
    startStream(video: HTMLVideoElement) {
        this.videoElement = video;
        this.activeLoop = true;
        this.startStreamingLoop();
    }

    stopStream() {
        this.activeLoop = false;
        this.videoElement = null;
    }

    /**
     * The Heartbeat of the Real-Time Pipeline.
     * Uses RequestAnimationFrame for smooth timing.
     */
    private startStreamingLoop() {
        if (!this.activeLoop) return;

        requestAnimationFrame(() => this.captureFrame());
    }

    private captureFrame() {
        if (!this.activeLoop || !this.videoElement || !this.isConnected || !this.socket) {
            // Keep the loop alive check even if not ready to send yet
            if (this.activeLoop) requestAnimationFrame(() => this.captureFrame());
            return;
        }

        const now = performance.now();
        const elapsed = now - this.lastFrameTime;

        // 1. FPS Throttling
        if (elapsed < this.FRAME_INTERVAL) {
            requestAnimationFrame(() => this.captureFrame());
            return;
        }

        // 2. Network Backpressure Check
        if (this.socket.bufferedAmount > this.BACKPRESSURE_THRESHOLD) {
            // console.warn(`Backpressure: Dropping frame. Buffer: ${this.socket.bufferedAmount}`);
            requestAnimationFrame(() => this.captureFrame());
            return;
        }

        // 3. Process Frame
        if (this.videoElement.videoWidth > 0) {
            const width = 640; // Normalize size for bandwidth/speed
            const scale = width / this.videoElement.videoWidth;
            const height = this.videoElement.videoHeight * scale;

            if (this.canvasElement.width !== width) {
                this.canvasElement.width = width;
                this.canvasElement.height = height;
            }

            const ctx = this.canvasElement.getContext('2d', { alpha: false }); // Optimize
            if (ctx) {
                ctx.drawImage(this.videoElement, 0, 0, width, height);
                
                this.canvasElement.toBlob((blob) => {
                    if (blob && this.socket?.readyState === WebSocket.OPEN) {
                        this.socket.send(blob);
                        this.lastFrameTime = now;
                    }
                }, 'image/jpeg', 0.6); // 60% quality is sufficient for AI
            }
        }

        requestAnimationFrame(() => this.captureFrame());
    }

    disconnect() {
        this.stopStream();
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }

    onResult(callback: (tracks: TrackedFace[], heatmap?: any, alerts?: any[]) => void) {
        this.listeners.push(callback);
    }

    private notifyListeners(tracks: TrackedFace[], heatmap?: any, alerts?: any[]) {
        this.listeners.forEach(cb => cb(tracks, heatmap, alerts));
    }
}

export const streamService = new StreamService();
