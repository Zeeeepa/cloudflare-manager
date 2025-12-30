import type { ResourcePlugin, TaskTypeDefinition, TaskContext, TaskResult } from './types.js';

// 插件注册中心
export class PluginRegistry {
  private static instance: PluginRegistry;
  private plugins: Map<string, ResourcePlugin> = new Map();
  private taskHandlers: Map<string, TaskTypeDefinition> = new Map();

  private constructor() {}

  static getInstance(): PluginRegistry {
    if (!PluginRegistry.instance) {
      PluginRegistry.instance = new PluginRegistry();
    }
    return PluginRegistry.instance;
  }

  // 注册插件
  register(plugin: ResourcePlugin): void {
    if (this.plugins.has(plugin.resourceType)) {
      console.warn(`插件 ${plugin.resourceType} 已存在，将被覆盖`);
    }

    this.plugins.set(plugin.resourceType, plugin);

    // 注册插件的任务类型
    const taskTypes = plugin.getTaskTypes();
    for (const taskType of taskTypes) {
      const fullType = `${plugin.resourceType}:${taskType.type}`;
      this.taskHandlers.set(fullType, taskType);
      console.log(`注册任务类型: ${fullType}`);
    }

    console.log(`插件已注册: ${plugin.name} (${plugin.resourceType})`);
  }

  // 注销插件
  unregister(resourceType: string): boolean {
    const plugin = this.plugins.get(resourceType);
    if (!plugin) return false;

    // 移除任务类型
    const taskTypes = plugin.getTaskTypes();
    for (const taskType of taskTypes) {
      const fullType = `${resourceType}:${taskType.type}`;
      this.taskHandlers.delete(fullType);
    }

    this.plugins.delete(resourceType);
    console.log(`插件已注销: ${resourceType}`);
    return true;
  }

  // 获取插件
  getPlugin(resourceType: string): ResourcePlugin | undefined {
    return this.plugins.get(resourceType);
  }

  // 获取所有插件
  getAllPlugins(): ResourcePlugin[] {
    return Array.from(this.plugins.values());
  }

  // 获取任务处理器
  getTaskHandler(taskType: string): TaskTypeDefinition | undefined {
    return this.taskHandlers.get(taskType);
  }

  // 获取所有任务类型
  getAllTaskTypes(): { type: string; definition: TaskTypeDefinition }[] {
    return Array.from(this.taskHandlers.entries()).map(([type, definition]) => ({
      type,
      definition,
    }));
  }

  // 执行任务
  async executeTask(taskType: string, context: TaskContext): Promise<TaskResult> {
    const handler = this.taskHandlers.get(taskType);
    if (!handler) {
      return {
        success: false,
        error: `未知的任务类型: ${taskType}`,
      };
    }

    try {
      return await handler.execute(context);
    } catch (error: any) {
      return {
        success: false,
        error: error.message || '任务执行失败',
      };
    }
  }

  // 检查任务类型是否存在
  hasTaskType(taskType: string): boolean {
    return this.taskHandlers.has(taskType);
  }

  // 获取插件列表（用于前端展示）
  getPluginList(): Array<{
    name: string;
    displayName: string;
    description: string;
    resourceType: string;
    taskTypes: string[];
  }> {
    return this.getAllPlugins().map(plugin => ({
      name: plugin.name,
      displayName: plugin.displayName,
      description: plugin.description,
      resourceType: plugin.resourceType,
      taskTypes: plugin.getTaskTypes().map(t => t.type),
    }));
  }
}

// 导出单例
export const pluginRegistry = PluginRegistry.getInstance();
