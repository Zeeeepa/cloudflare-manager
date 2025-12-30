import { Router } from 'express';
import { pluginRegistry } from '../core/plugin/index.js';

export function createPluginsRouter(): Router {
  const router = Router();

  // 获取所有已注册插件
  router.get('/', (req, res) => {
    const plugins = pluginRegistry.getPluginList();
    res.json({ plugins });
  });

  // 获取单个插件详情
  router.get('/:resourceType', (req, res) => {
    const { resourceType } = req.params;
    const plugin = pluginRegistry.getPlugin(resourceType);

    if (!plugin) {
      return res.status(404).json({ error: `插件 ${resourceType} 不存在` });
    }

    res.json({
      name: plugin.name,
      displayName: plugin.displayName,
      description: plugin.description,
      resourceType: plugin.resourceType,
      icon: plugin.icon,
      taskTypes: plugin.getTaskTypes().map(t => ({
        type: t.type,
        displayName: t.displayName,
        description: t.description,
        configSchema: t.configSchema,
      })),
      listColumns: plugin.getListColumns(),
      createForm: plugin.getCreateForm?.(),
      updateForm: plugin.getUpdateForm?.(),
    });
  });

  // 获取所有任务类型
  router.get('/tasks/types', (req, res) => {
    const taskTypes = pluginRegistry.getAllTaskTypes().map(({ type, definition }) => ({
      type,
      displayName: definition.displayName,
      description: definition.description,
      configSchema: definition.configSchema,
    }));
    res.json({ taskTypes });
  });

  return router;
}
