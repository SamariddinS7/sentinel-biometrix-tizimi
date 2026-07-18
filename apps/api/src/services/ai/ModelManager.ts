import { AiPlugin, DeviceType, PluginConfig, RuntimeDevice } from './interfaces';

export class ModelManager {
  private static instance: ModelManager;
  private loadedPlugins: Map<string, AiPlugin> = new Map();
  private deviceAssignments: Map<string, RuntimeDevice> = new Map();

  private constructor() {}

  public static getInstance(): ModelManager {
    if (!ModelManager.instance) {
      ModelManager.instance = new ModelManager();
    }
    return ModelManager.instance;
  }

  /**
   * Registers and boots an AI plugin inside the engine container.
   */
  public async registerAndLoadPlugin(
    plugin: AiPlugin,
    config: PluginConfig,
    targetDevice: RuntimeDevice
  ): Promise<boolean> {
    const pluginId = plugin.metadata.id;
    console.log(`[AI ModelManager] Registering plugin: ${plugin.metadata.name} (v${plugin.metadata.version})`);

    // Verify hardware support compatibility
    if (!plugin.metadata.supportedDevices.includes(targetDevice.type)) {
      throw new Error(
        `Hardware device type "${targetDevice.type}" is not supported by plugin "${plugin.metadata.name}". Supported: ${plugin.metadata.supportedDevices.join(', ')}`
      );
    }

    try {
      const initialized = await plugin.initialize(config);
      if (!initialized) {
        console.error(`[AI ModelManager] Failed to initialize plugin "${pluginId}"`);
        return false;
      }

      const loaded = await plugin.load(targetDevice);
      if (!loaded) {
        console.error(`[AI ModelManager] Failed to bind plugin "${pluginId}" to device ${targetDevice.type}:${targetDevice.index}`);
        return false;
      }

      this.loadedPlugins.set(pluginId, plugin);
      this.deviceAssignments.set(pluginId, targetDevice);
      console.log(`[AI ModelManager] Plugin "${pluginId}" loaded successfully on ${targetDevice.type}:${targetDevice.index}`);
      return true;
    } catch (error: any) {
      console.error(`[AI ModelManager] Critical failure during loading of "${pluginId}":`, error);
      return false;
    }
  }

  /**
   * Dynamically hot-reloads plugin thresholds and configurations at runtime.
   */
  public async hotReloadConfig(pluginId: string, newConfig: PluginConfig): Promise<boolean> {
    const plugin = this.loadedPlugins.get(pluginId);
    if (!plugin) {
      console.error(`[AI ModelManager] Cannot hot-reload. Plugin "${pluginId}" is not loaded.`);
      return false;
    }

    console.log(`[AI ModelManager] Hot-reloading config for plugin "${pluginId}"...`);
    const success = await plugin.initialize(newConfig);
    return success;
  }

  /**
   * Safely unloads a plugin and deallocates hardware memory.
   */
  public async unloadPlugin(pluginId: string): Promise<boolean> {
    const plugin = this.loadedPlugins.get(pluginId);
    if (!plugin) {
      return false;
    }

    console.log(`[AI ModelManager] Unloading plugin: ${pluginId}`);
    const success = await plugin.unload();
    if (success) {
      this.loadedPlugins.delete(pluginId);
      this.deviceAssignments.delete(pluginId);
    }
    return success;
  }

  /**
   * Retrieves an active loaded plugin instance.
   */
  public getPlugin(pluginId: string): AiPlugin | undefined {
    return this.loadedPlugins.get(pluginId);
  }

  /**
   * Lists metadata and statuses of all registered plugins.
   */
  public getActivePluginsList() {
    return Array.from(this.loadedPlugins.values()).map(plugin => ({
      metadata: plugin.metadata,
      state: plugin.state,
      config: plugin.config,
      device: this.deviceAssignments.get(plugin.metadata.id)
    }));
  }

  /**
   * Executes a comprehensive diagnostic health sweep over active plugin runtimes.
   */
  public async runEngineHealthSweep() {
    const report: Record<string, { state: string; status: string; latencyMs: number; error?: string }> = {};
    for (const [id, plugin] of this.loadedPlugins.entries()) {
      const health = await plugin.healthCheck();
      report[id] = {
        state: plugin.state,
        status: health.status,
        latencyMs: health.latencyMs,
        error: health.error
      };
    }
    return report;
  }
}
