import { AiPlugin, AiPluginMetadata, PluginConfig, PluginState, RuntimeDevice, VideoFrame, DynamicDetectionPayload } from '../interfaces';

export abstract class BaseAiPlugin implements AiPlugin {
  public abstract metadata: AiPluginMetadata;
  public state: PluginState = 'UNLOADED';
  public config: PluginConfig = { threshold: 0.5 };
  protected device?: RuntimeDevice;
  protected loadedModelPath?: string;

  public async initialize(config: PluginConfig): Promise<boolean> {
    this.config = { ...this.config, ...config };
    this.state = 'UNLOADED';
    return true;
  }

  public async load(device: RuntimeDevice): Promise<boolean> {
    this.state = 'LOADING';
    this.device = device;
    try {
      const loaded = await this.onLoadModel(device);
      if (loaded) {
        this.state = 'LOADED';
        return true;
      } else {
        this.state = 'ERROR';
        return false;
      }
    } catch (error) {
      this.state = 'ERROR';
      return false;
    }
  }

  public async infer(frame: VideoFrame): Promise<DynamicDetectionPayload> {
    if (this.state !== 'LOADED') {
      throw new Error(`Plugin "${this.metadata.name}" is not loaded. Current state: ${this.state}`);
    }
    return this.onExecuteInference(frame);
  }

  public async unload(): Promise<boolean> {
    try {
      await this.onUnloadModel();
      this.state = 'UNLOADED';
      this.device = undefined;
      return true;
    } catch (e) {
      this.state = 'ERROR';
      return false;
    }
  }

  public async healthCheck(): Promise<{ status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY'; latencyMs: number; error?: string }> {
    if (this.state === 'ERROR') {
      return { status: 'UNHEALTHY', latencyMs: 0, error: 'Plugin is in an unrecoverable error state' };
    }
    if (this.state !== 'LOADED') {
      return { status: 'UNHEALTHY', latencyMs: 0, error: 'Plugin is not loaded' };
    }
    try {
      const start = Date.now();
      const healthy = await this.onPerformDiagnostic();
      const latencyMs = Date.now() - start;
      return {
        status: healthy ? 'HEALTHY' : 'DEGRADED',
        latencyMs,
      };
    } catch (err: any) {
      return {
        status: 'UNHEALTHY',
        latencyMs: 0,
        error: err.message || 'Diagnostic execution failed',
      };
    }
  }

  /**
   * Hardware-specific model loading implementation.
   */
  protected abstract onLoadModel(device: RuntimeDevice): Promise<boolean>;

  /**
   * Raw forward propagation implementation.
   */
  protected abstract onExecuteInference(frame: VideoFrame): Promise<DynamicDetectionPayload>;

  /**
   * Memory deallocation implementation.
   */
  protected abstract onUnloadModel(): Promise<void>;

  /**
   * Diagnostic test execution implementation.
   */
  protected abstract onPerformDiagnostic(): Promise<boolean>;
}
