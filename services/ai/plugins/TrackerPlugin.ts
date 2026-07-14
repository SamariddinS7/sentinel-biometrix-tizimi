import { BaseAiPlugin } from './BaseAiPlugin';
import { AiPluginMetadata, RuntimeDevice, VideoFrame, DynamicDetectionPayload } from '../interfaces';

export class TrackerPlugin extends BaseAiPlugin {
  public metadata: AiPluginMetadata = {
    id: 'core.tracker',
    name: 'ByteTrack Engine',
    version: '2.0.1',
    vendor: 'Sentinel Biometrik',
    supportedDevices: ['CPU'],
    description: 'Associates spatial temporal bounding boxes over consecutive frames to maintain distinct track identities.'
  };

  protected async onLoadModel(device: RuntimeDevice): Promise<boolean> {
    // ByteTrack is purely algorithmic (Kalman Filters + Hungarian Association) and runs on CPU natively
    return true;
  }

  protected async onExecuteInference(frame: VideoFrame): Promise<DynamicDetectionPayload> {
    return {
      cameraId: frame.cameraId,
      timestamp: frame.timestamp,
      frameId: frame.id,
      detections: [] // Production real: ByteTrack update loop associating previous boxes with newly incoming boxes
    };
  }

  protected async onUnloadModel(): Promise<void> {
    // No-op
  }

  protected async onPerformDiagnostic(): Promise<boolean> {
    return true;
  }
}
