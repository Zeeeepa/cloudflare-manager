import { pluginRegistry } from '../core/plugin/index.js';
import { eventBus } from '../core/event/index.js';
import { workersPlugin } from './workers/index.js';
import { kvPlugin } from './kv/index.js';

// 注册所有内置插件
export function registerBuiltinPlugins(): void {
  console.log('正在注册内置插件...');

  // Workers 插件
  pluginRegistry.register(workersPlugin);
  eventBus.emit('plugin:registered', {
    resourceType: workersPlugin.resourceType,
    name: workersPlugin.name,
  });

  // KV 插件
  pluginRegistry.register(kvPlugin);
  eventBus.emit('plugin:registered', {
    resourceType: kvPlugin.resourceType,
    name: kvPlugin.name,
  });

  console.log(`已注册 ${pluginRegistry.getAllPlugins().length} 个插件`);
  console.log(`已注册 ${pluginRegistry.getAllTaskTypes().length} 个任务类型`);
}

// 导出所有插件
export { workersPlugin } from './workers/index.js';
export { kvPlugin } from './kv/index.js';
