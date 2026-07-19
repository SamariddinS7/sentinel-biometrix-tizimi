import React, { useEffect, useRef, useState } from 'react';
import { detectionStore } from '../lib/DetectionStore';
import { useLanguage } from '../services/i18n';
import { userService } from '../services/userService';

declare const faceapi: any;

export const useDetectionEngine = (
    cameraId: string, 
    mediaRef: React.RefObject<HTMLVideoElement | HTMLImageElement>, 
    isActive: boolean, 
    config: any,
    language: string
) => {
    const [enrolledDescriptors, setEnrolledDescriptors] = useState<Record<string, { fullName: string, desc: Float32Array }>>({});

    useEffect(() => {
        const loadUsers = async () => {
            if (config.recognizeFaces) {
                try {
                    const allUsers = await userService.getAllUsers();
                    const descriptorsMap: Record<string, { fullName: string, desc: Float32Array }> = {};
                    for (const u of allUsers) {
                        if (u.faceDescriptor && u.faceDescriptor.length > 0) {
                            descriptorsMap[u.id] = { fullName: u.fullName, desc: new Float32Array(u.faceDescriptor) };
                        }
                    }
                    setEnrolledDescriptors(descriptorsMap);
                } catch (err) {
                    console.error("Failed to load users for detection overlay", err);
                }
            }
        };
        loadUsers();
    }, [config.recognizeFaces]);

    useEffect(() => {
        if (!isActive || !config.detectPeople) {
            detectionStore.set(cameraId, { engineActive: false });
            return;
        }

        let active = true;
        let detectionTimeout: any = null;
        let lastFrameTime = performance.now();
        let ws: WebSocket | null = null;
        let isWsConnected = false;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const token = localStorage.getItem('sentinel_token') || '';
        const wsUrl = `${protocol}//${window.location.host}/ws/live-stream/${cameraId}?token=${encodeURIComponent(token)}`;
        
        try {
            ws = new WebSocket(wsUrl);
            ws.onopen = () => {
                isWsConnected = true;
            };
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'result' && active) {
                        const mapped = data.tracks.map((track: any) => ({
                            id: track.trackId,
                            x: track.bbox.x,
                            y: track.bbox.y,
                            w: track.bbox.w,
                            h: track.bbox.h,
                            label: track.identity?.fullName || (language === 'uz' ? `Odam #${track.trackId}` : `Person #${track.trackId}`),
                            confidence: track.detectionScore,
                            color: 'cyan'
                        }));
                        
                        detectionStore.set(cameraId, {
                            objects: mapped,
                            sourceWidth: 640,
                            sourceHeight: 480,
                            inferenceTime: 12,
                            fps: 25,
                            engineActive: true
                        });
                    }
                } catch (e) {
                    console.error("[CanvasOverlay WS] Error parsing message:", e);
                }
            };
            ws.onclose = () => {
                isWsConnected = false;
            };
            ws.onerror = () => {
                isWsConnected = false;
            };
        } catch (err) {
            console.warn("[CanvasOverlay WS] Failed to initialize:", err);
        }

        const offscreenCanvas = document.createElement('canvas');

        const runDetection = async () => {
            if (!active) return;
            const parent = mediaRef.current;
            if (!parent) {
                detectionTimeout = setTimeout(runDetection, 250);
                return;
            }
            const mediaEl = parent.tagName === 'VIDEO' || parent.tagName === 'IMG' ? parent : parent.querySelector('video') || parent.querySelector('img');

            if (!mediaEl) {
                detectionTimeout = setTimeout(runDetection, 250);
                return;
            }

            let isReady = true;
            if (mediaEl instanceof HTMLVideoElement) {
                isReady = mediaEl.readyState >= 2 && !mediaEl.paused && !mediaEl.ended;
            }

            if (isReady && isWsConnected && ws && ws.readyState === WebSocket.OPEN) {
                const width = 640;
                const sourceWidth = (mediaEl instanceof HTMLVideoElement ? mediaEl.videoWidth : mediaEl.naturalWidth) || mediaEl.clientWidth || 640;
                const sourceHeight = (mediaEl instanceof HTMLVideoElement ? mediaEl.videoHeight : mediaEl.naturalHeight) || mediaEl.clientHeight || 480;
                const scale = width / sourceWidth;
                const height = sourceHeight * scale;

                offscreenCanvas.width = width;
                offscreenCanvas.height = height;
                const ctx = offscreenCanvas.getContext('2d', { alpha: false });
                if (ctx) {
                    ctx.drawImage(mediaEl, 0, 0, width, height);
                    offscreenCanvas.toBlob((blob) => {
                        if (blob && ws && ws.readyState === WebSocket.OPEN && active) {
                            ws.send(blob);
                        }
                    }, 'image/jpeg', 0.5);
                }
            } else if (isReady && typeof faceapi !== 'undefined' && faceapi.nets && faceapi.nets.tinyFaceDetector && faceapi.nets.tinyFaceDetector.params) {
                const startTime = performance.now();
                try {
                    let detectionsResult: any[] = [];
                    if (config.recognizeFaces && faceapi.nets.faceLandmark68Net.params && faceapi.nets.faceRecognitionNet.params) {
                        detectionsResult = await faceapi.detectAllFaces(mediaEl, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.45 }))
                            .withFaceLandmarks().withFaceDescriptors();
                    } else {
                        detectionsResult = await faceapi.detectAllFaces(mediaEl, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.45 }));
                    }

                    const endTime = performance.now();
                    const inferenceTime = endTime - startTime;
                    const fps = 1000 / (endTime - lastFrameTime);
                    lastFrameTime = endTime;

                    const sourceWidth = (mediaEl instanceof HTMLVideoElement ? mediaEl.videoWidth : mediaEl.naturalWidth) || mediaEl.clientWidth || 640;
                    const sourceHeight = (mediaEl instanceof HTMLVideoElement ? mediaEl.videoHeight : mediaEl.naturalHeight) || mediaEl.clientHeight || 480;

                    if (active) {
                        if (detectionsResult && detectionsResult.length > 0) {
                            const mapped = detectionsResult.map((det: any, index: number) => {
                                const box = det.detection?.box || det.box || det._box || det;
                                let label = language === 'uz' ? `Odam #${index + 1}` : `Person #${index + 1}`;
                                let color = 'cyan';

                                if (config.recognizeFaces && det.descriptor) {
                                    let bestMatch = null;
                                    let minDistance = 0.65;
                                    for (const [userId, user] of Object.entries(enrolledDescriptors)) {
                                        const dist = faceapi.euclideanDistance(det.descriptor, user.desc);
                                        if (dist < minDistance) {
                                            minDistance = dist;
                                            bestMatch = user;
                                        }
                                    }
                                    if (bestMatch) {
                                        label = bestMatch.fullName;
                                        color = '#10b981'; // emerald for verified
                                    } else {
                                        label = language === 'uz' ? 'Noma\'lum' : 'Unknown';
                                        color = '#f43f5e'; // rose for unknown
                                    }
                                }

                                return {
                                    id: 2000 + index,
                                    x: box.x,
                                    y: box.y,
                                    w: box.width,
                                    h: box.height,
                                    label,
                                    confidence: det.score || det.detection?.score || 0.99,
                                    color
                                };
                            });
                            detectionStore.set(cameraId, { 
                                objects: mapped, 
                                sourceWidth, 
                                sourceHeight,
                                inferenceTime,
                                fps,
                                engineActive: true
                            });
                        } else {
                            detectionStore.set(cameraId, { 
                                objects: [], 
                                sourceWidth, 
                                sourceHeight,
                                inferenceTime,
                                fps,
                                engineActive: true
                            });
                        }
                    }
                } catch (err) {
                    console.warn(`Overlay detection error for ${cameraId}:`, err);
                }
            }

            if (active) {
                detectionTimeout = setTimeout(runDetection, 100);
            }
        };

        runDetection();
        return () => {
            active = false;
            if (detectionTimeout) clearTimeout(detectionTimeout);
            if (ws) {
                try {
                    ws.close();
                } catch (e) {}
            }
            detectionStore.set(cameraId, { engineActive: false });
        };
    }, [cameraId, isActive, config.detectPeople, language, mediaRef]);
};

export const CanvasOverlay: React.FC<{
    cameraId: string;
    mediaRef: React.RefObject<HTMLElement>;
    config: any;
    debug?: boolean;
}> = ({ cameraId, mediaRef, config, debug = false }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const parent = mediaRef.current;
        if (!canvas || !parent) return;
        const media = parent.tagName === 'VIDEO' || parent.tagName === 'IMG' ? parent : parent.querySelector('video') || parent.querySelector('img') || parent;
        if (!canvas || !media) return;

        let animationFrameId: number;
        let displayWidth = 0;
        let displayHeight = 0;

        const resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                if (entry.target === media) {
                    displayWidth = entry.contentRect.width;
                    displayHeight = entry.contentRect.height;
                    canvas.width = displayWidth;
                    canvas.height = displayHeight;
                }
            }
        });
        resizeObserver.observe(media);

        displayWidth = media.clientWidth;
        displayHeight = media.clientHeight;
        canvas.width = displayWidth;
        canvas.height = displayHeight;

        let renderFps = 0;
        let lastRenderTime = performance.now();

        const render = () => {
            animationFrameId = requestAnimationFrame(render);
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const now = performance.now();
            renderFps = 1000 / (now - lastRenderTime);
            lastRenderTime = now;

            const state = detectionStore.get(cameraId);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const scaleX = canvas.width / state.sourceWidth;
            const scaleY = canvas.height / state.sourceHeight;

            if (cameraId === 'CAM-01' && config.enableCounting) {
                const lineX = state.sourceWidth * 0.5 * scaleX;
                ctx.beginPath();
                ctx.moveTo(lineX, 0);
                ctx.lineTo(lineX, canvas.height);
                ctx.lineWidth = 2;
                ctx.strokeStyle = state.tripwireActive ? 'rgba(16, 185, 129, 0.8)' : 'rgba(239, 68, 68, 0.5)';
                ctx.stroke();

                ctx.fillStyle = state.tripwireActive ? 'rgba(16, 185, 129, 0.9)' : 'rgba(239, 68, 68, 0.8)';
                ctx.font = 'bold 12px monospace';
                ctx.fillText(`IN: ${state.inCount} | OUT: ${state.outCount}`, lineX + 10, canvas.height / 3);
            }

            if (config.detectPeople) {
                state.objects.forEach(obj => {
                    const x = obj.x * scaleX;
                    const y = obj.y * scaleY;
                    const w = (obj.w || 0) * scaleX;
                    const h = (obj.h || 0) * scaleY;

                    ctx.strokeStyle = 'rgba(6, 182, 212, 0.8)';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(x, y, w, h);

                    ctx.fillStyle = 'rgba(6, 182, 212, 0.15)';
                    ctx.fillRect(x, y, w, h);

                    const labelText = `${obj.label} (${Math.round(obj.confidence * 100)}%)`;
                    ctx.font = 'bold 10px monospace';
                    const textWidth = ctx.measureText(labelText).width;
                    
                    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
                    ctx.fillRect(x, y, textWidth + 8, 16);

                    ctx.fillStyle = '#fff';
                    ctx.fillText(labelText, x + 4, y + 11);
                });
            }

            if (debug) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                ctx.fillRect(5, 5, 220, 110);
                ctx.fillStyle = '#10b981';
                ctx.font = '10px monospace';
                ctx.fillText(`Stream: ${cameraId}`, 10, 20);
                ctx.fillText(`Video Res: ${state.sourceWidth}x${state.sourceHeight}`, 10, 35);
                ctx.fillText(`Canvas Res: ${canvas.width}x${canvas.height}`, 10, 50);
                ctx.fillText(`Tracking FPS: ${Math.round(state.fps)}`, 10, 65);
                ctx.fillText(`Render FPS: ${Math.round(renderFps)}`, 10, 80);
                ctx.fillText(`Detections: ${state.objects.length}`, 10, 95);
                ctx.fillText(`Engine Active: ${state.engineActive}`, 10, 110);
            }
        };

        render();

        return () => {
            cancelAnimationFrame(animationFrameId);
            resizeObserver.disconnect();
        };
    }, [cameraId, config]);

    return (
        <canvas 
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full pointer-events-none z-[999]"
            style={{ position: 'absolute' }}
        />
    );
};

export const UnifiedCameraOverlay: React.FC<{
    cameraId: string;
    mediaRef: React.RefObject<HTMLElement>;
    isActive: boolean;
    config: any;
}> = ({ cameraId, mediaRef, isActive, config }) => {
    const { language } = useLanguage();
    useDetectionEngine(cameraId, mediaRef as any, isActive, config, language);

    return <CanvasOverlay cameraId={cameraId} mediaRef={mediaRef} config={config} debug={false} />;
};
