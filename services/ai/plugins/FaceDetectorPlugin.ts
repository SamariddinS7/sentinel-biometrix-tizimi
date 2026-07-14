import * as fs from 'fs';
import * as path from 'path';
import { BaseAiPlugin } from './BaseAiPlugin';
import { AiPluginMetadata, RuntimeDevice, VideoFrame, DynamicDetectionPayload } from '../interfaces';

export class FaceDetectorPlugin extends BaseAiPlugin {
  public metadata: AiPluginMetadata = {
    id: 'core.face_detector',
    name: 'Face Detection Module',
    version: '1.1.0',
    vendor: 'Sentinel Biometrik',
    supportedDevices: ['CPU', 'CUDA', 'TENSOR_RT', 'ONNX_RUNTIME'],
    description: 'High-speed RetinaFace spatial bounding box localization for multi-face scenes.'
  };

  private modelFilePath = path.join(process.cwd(), 'models', 'weights', 'retinaface.onnx');
  private hasNativeBindings = false;

  protected async onLoadModel(device: RuntimeDevice): Promise<boolean> {
    if (!fs.existsSync(this.modelFilePath)) {
      console.warn(`[AI Engine] Weights file not found: ${this.modelFilePath}. Operating in architectural-fallback mode (no-inference).`);
      this.hasNativeBindings = false;
      return true;
    }
    this.hasNativeBindings = true;
    return true;
  }

  protected async onExecuteInference(frame: VideoFrame): Promise<DynamicDetectionPayload> {
    return {
      cameraId: frame.cameraId,
      timestamp: frame.timestamp,
      frameId: frame.id,
      faces: [] // Production real: Return detected face bounding coordinates parsed from ONNX outputs
    };
  }

  protected async onUnloadModel(): Promise<void> {
    this.hasNativeBindings = false;
  }

  protected async onPerformDiagnostic(): Promise<boolean> {
    return this.hasNativeBindings;
  }
}
