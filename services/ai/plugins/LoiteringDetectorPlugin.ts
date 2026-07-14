import { BaseAiPlugin } from './BaseAiPlugin';
import { AiPluginMetadata, RuntimeDevice, VideoFrame, DynamicDetectionPayload } from '../interfaces';

export class LoiteringDetectorPlugin extends BaseAiPlugin {
  public metadata: AiPluginMetadata = {
    id: 'core.loitering_detector',
    name: 'Loitering Detection Module',
    version: '1.2.0',
    vendor: 'Sentinel Biometrik',
    supportedDevices: ['CPU'],
    description: 'Tracks human object temporal residence inside defined polygonal boundary limits.'
  };

  protected async onLoadModel(device: RuntimeDevice): Promise<boolean> {
    // Loitering tracking is algebraic, tracking temporal durations of active trackIDs in spatial boundaries
    return true;
  }

  protected async onExecuteInference(frame: VideoFrame): Promise<DynamicDetectionPayload> {
    return {
      cameraId: frame.cameraId,
      timestamp: frame.timestamp,
      frameId: frame.id,
      detections: [] // Production real: Map tracks and measure time delta inside regions
    };
  }

  protected async onUnloadModel(): Promise<void> {
    // No-op
  }

  protected async onPerformDiagnostic(): Promise<boolean> {
    return true;
  }
}
