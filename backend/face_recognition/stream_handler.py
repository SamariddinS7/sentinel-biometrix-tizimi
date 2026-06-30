
import json
import logging
import asyncio
from fastapi import WebSocket, WebSocketDisconnect
from .camera_manager import camera_manager

logger = logging.getLogger("StreamHandler")

class ConnectionManager:
    """
    Manages WebSocket Connections and bridges Sync (AI) -> Async (WS) worlds.
    """
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, camera_id: str):
        await websocket.accept()
        self.active_connections[camera_id] = websocket
        logger.info(f"Client connected to stream: {camera_id}")

    def disconnect(self, camera_id: str):
        if camera_id in self.active_connections:
            del self.active_connections[camera_id]
        # Signal camera manager to stop AI pipeline to save resources
        camera_manager.remove_camera(camera_id)
        logger.info(f"Client disconnected: {camera_id}")

manager = ConnectionManager()

async def websocket_endpoint(websocket: WebSocket, camera_id: str):
    """
    Real-Time WebSocket Handler.
    Splits into two tasks:
    1. Reading frames from client -> Pushing to AI
    2. Reading results from AI -> Sending to client
    """
    await manager.connect(websocket, camera_id)
    
    # 1. Start AI Pipeline
    # The pipeline runs in a separate Thread (not async loop)
    pipeline = camera_manager.get_or_create_pipeline(camera_id, mode='PUSH')
    
    # 2. Bridge Queue: AI Thread -> Async Websocket Loop
    # We need an asyncio Queue that is thread-safe for the producer (AI Thread)
    # Since asyncio.Queue is NOT thread-safe for put(), we use call_soon_threadsafe
    result_queue = asyncio.Queue()
    loop = asyncio.get_event_loop()
    
    def ai_callback(data):
        # This runs in the AI Thread. We must schedule the put() on the event loop.
        try:
            loop.call_soon_threadsafe(result_queue.put_nowait, data)
        except Exception as e:
            logger.error(f"Failed to bridge AI result: {e}")
            
    pipeline.set_output_callback(ai_callback)

    # 3. Create Tasks
    async def receive_frames():
        try:
            while True:
                # Read binary frame
                data = await websocket.receive_bytes()
                # Push to Pipeline (CPU-bound work happens in thread)
                pipeline.inject_frame(data)
        except WebSocketDisconnect:
            pass
        except Exception as e:
            logger.error(f"Receive loop error: {e}")

    async def send_results():
        try:
            while True:
                # Wait for result from AI
                result = await result_queue.get()
                # Send JSON to client
                await websocket.send_text(json.dumps(result))
        except Exception as e:
            logger.error(f"Send loop error: {e}")

    # 4. Run Bidirectional Loop
    try:
        reader_task = asyncio.create_task(receive_frames())
        writer_task = asyncio.create_task(send_results())
        
        # Wait until either fails (likely reader disconnects)
        done, pending = await asyncio.wait(
            [reader_task, writer_task], 
            return_when=asyncio.FIRST_COMPLETED
        )
        
        for task in pending:
            task.cancel()
            
    finally:
        manager.disconnect(camera_id)
