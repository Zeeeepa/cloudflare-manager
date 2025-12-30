import type {
  ResourcePlugin,
  TaskTypeDefinition,
  TaskContext,
  TaskResult,
  TableColumn,
  FormSchema,
} from '../../core/plugin/index.js';
import type { CloudflareAPI } from '../../services/CloudflareAPI.js';

// KV Namespace 插件实现
export const kvPlugin: ResourcePlugin = {
  name: 'kv',
  displayName: 'KV Storage',
  description: 'Cloudflare Workers KV 键值存储管理',
  resourceType: 'kv',
  icon: 'database',

  // 列出所有 KV Namespaces
  async list(api: CloudflareAPI): Promise<any[]> {
    return await api.listKVNamespaces();
  },

  // 创建 KV Namespace
  async create(api: CloudflareAPI, data: { title: string }): Promise<any> {
    return await api.createKVNamespace(data.title);
  },

  // 删除 KV Namespace
  async delete(api: CloudflareAPI, namespaceId: string): Promise<void> {
    await api.deleteKVNamespace(namespaceId);
  },

  // 任务类型定义
  getTaskTypes(): TaskTypeDefinition[] {
    return [
      listNamespacesTask,
      createNamespaceTask,
      deleteNamespaceTask,
      listKeysTask,
      getValueTask,
      putValueTask,
      deleteKeyTask,
      bulkWriteTask,
      bulkDeleteTask,
    ];
  },

  // 列表列定义
  getListColumns(): TableColumn[] {
    return [
      { key: 'title', label: '名称', sortable: true },
      { key: 'id', label: 'Namespace ID' },
    ];
  },

  // 创建表单
  getCreateForm(): FormSchema {
    return {
      fields: [
        { name: 'title', label: 'Namespace 名称', type: 'text', required: true },
      ],
    };
  },
};

// 列出 Namespaces 任务
const listNamespacesTask: TaskTypeDefinition = {
  type: 'list',
  displayName: '列出 KV Namespaces',
  description: '列出账号下所有 KV Namespaces',
  configSchema: { fields: [] },
  async execute(context: TaskContext): Promise<TaskResult> {
    const { api, updateProgress } = context;

    updateProgress({ step: '获取 KV Namespaces', current: 1, total: 1 });
    const namespaces = await api.listKVNamespaces();

    return {
      success: true,
      data: { count: namespaces.length, namespaces },
    };
  },
};

// 创建 Namespace 任务
const createNamespaceTask: TaskTypeDefinition = {
  type: 'create',
  displayName: '创建 KV Namespace',
  description: '创建新的 KV Namespace',
  configSchema: {
    fields: [
      { name: 'title', label: 'Namespace 名称', type: 'text', required: true },
    ],
  },
  async execute(context: TaskContext): Promise<TaskResult> {
    const { api, config, updateProgress } = context;

    updateProgress({ step: '创建 KV Namespace', current: 1, total: 1 });
    const namespace = await api.createKVNamespace(config.title);

    return {
      success: true,
      data: namespace,
    };
  },
};

// 删除 Namespace 任务
const deleteNamespaceTask: TaskTypeDefinition = {
  type: 'delete',
  displayName: '删除 KV Namespace',
  description: '删除指定的 KV Namespace',
  configSchema: {
    fields: [
      { name: 'namespaceId', label: 'Namespace ID', type: 'text', required: true },
    ],
  },
  async execute(context: TaskContext): Promise<TaskResult> {
    const { api, config, updateProgress } = context;

    updateProgress({ step: '删除 KV Namespace', current: 1, total: 1 });
    await api.deleteKVNamespace(config.namespaceId);

    return { success: true, data: { deleted: true } };
  },
};

// 列出键任务
const listKeysTask: TaskTypeDefinition = {
  type: 'list_keys',
  displayName: '列出 KV 键',
  description: '列出 Namespace 中的所有键',
  configSchema: {
    fields: [
      { name: 'namespaceId', label: 'Namespace ID', type: 'text', required: true },
      { name: 'prefix', label: '前缀过滤', type: 'text' },
      { name: 'limit', label: '数量限制', type: 'number', defaultValue: 1000 },
    ],
  },
  async execute(context: TaskContext): Promise<TaskResult> {
    const { api, config, updateProgress } = context;

    updateProgress({ step: '获取 KV 键列表', current: 1, total: 1 });
    const result = await api.listKVKeys(config.namespaceId, {
      prefix: config.prefix,
      limit: config.limit,
    });

    return {
      success: true,
      data: { count: result.keys.length, keys: result.keys, cursor: result.cursor },
    };
  },
};

// 获取值任务
const getValueTask: TaskTypeDefinition = {
  type: 'get',
  displayName: '获取 KV 值',
  description: '获取指定键的值',
  configSchema: {
    fields: [
      { name: 'namespaceId', label: 'Namespace ID', type: 'text', required: true },
      { name: 'key', label: '键名', type: 'text', required: true },
    ],
  },
  async execute(context: TaskContext): Promise<TaskResult> {
    const { api, config, updateProgress } = context;

    updateProgress({ step: '获取 KV 值', current: 1, total: 1 });
    const value = await api.getKVValue(config.namespaceId, config.key);

    return {
      success: true,
      data: { key: config.key, value },
    };
  },
};

// 写入值任务
const putValueTask: TaskTypeDefinition = {
  type: 'put',
  displayName: '写入 KV 值',
  description: '写入或更新键值对',
  configSchema: {
    fields: [
      { name: 'namespaceId', label: 'Namespace ID', type: 'text', required: true },
      { name: 'key', label: '键名', type: 'text', required: true },
      { name: 'value', label: '值', type: 'textarea', required: true },
      { name: 'expirationTtl', label: '过期时间(秒)', type: 'number' },
    ],
  },
  async execute(context: TaskContext): Promise<TaskResult> {
    const { api, config, updateProgress } = context;

    updateProgress({ step: '写入 KV 值', current: 1, total: 1 });
    await api.putKVValue(config.namespaceId, config.key, config.value, {
      expirationTtl: config.expirationTtl,
    });

    return { success: true, data: { key: config.key, written: true } };
  },
};

// 删除键任务
const deleteKeyTask: TaskTypeDefinition = {
  type: 'delete_key',
  displayName: '删除 KV 键',
  description: '删除指定的键',
  configSchema: {
    fields: [
      { name: 'namespaceId', label: 'Namespace ID', type: 'text', required: true },
      { name: 'key', label: '键名', type: 'text', required: true },
    ],
  },
  async execute(context: TaskContext): Promise<TaskResult> {
    const { api, config, updateProgress } = context;

    updateProgress({ step: '删除 KV 键', current: 1, total: 1 });
    await api.deleteKVKey(config.namespaceId, config.key);

    return { success: true, data: { key: config.key, deleted: true } };
  },
};

// 批量写入任务
const bulkWriteTask: TaskTypeDefinition = {
  type: 'bulk_write',
  displayName: '批量写入 KV',
  description: '批量写入多个键值对',
  configSchema: {
    fields: [
      { name: 'namespaceId', label: 'Namespace ID', type: 'text', required: true },
      { name: 'kvPairs', label: '键值对 (JSON)', type: 'textarea', required: true, placeholder: '[{"key":"k1","value":"v1"}]' },
    ],
  },
  async execute(context: TaskContext): Promise<TaskResult> {
    const { api, config, updateProgress } = context;

    let kvPairs: Array<{ key: string; value: string }>;
    try {
      kvPairs = JSON.parse(config.kvPairs);
    } catch {
      return { success: false, error: '无效的 JSON 格式' };
    }

    updateProgress({ step: '批量写入 KV', current: 1, total: 1 });
    await api.bulkWriteKV(config.namespaceId, kvPairs);

    return { success: true, data: { count: kvPairs.length, written: true } };
  },
};

// 批量删除任务
const bulkDeleteTask: TaskTypeDefinition = {
  type: 'bulk_delete',
  displayName: '批量删除 KV',
  description: '批量删除多个键',
  configSchema: {
    fields: [
      { name: 'namespaceId', label: 'Namespace ID', type: 'text', required: true },
      { name: 'keys', label: '键名列表 (JSON)', type: 'textarea', required: true, placeholder: '["key1","key2"]' },
    ],
  },
  async execute(context: TaskContext): Promise<TaskResult> {
    const { api, config, updateProgress } = context;

    let keys: string[];
    try {
      keys = JSON.parse(config.keys);
    } catch {
      return { success: false, error: '无效的 JSON 格式' };
    }

    updateProgress({ step: '批量删除 KV', current: 1, total: 1 });
    await api.bulkDeleteKV(config.namespaceId, keys);

    return { success: true, data: { count: keys.length, deleted: true } };
  },
};

export default kvPlugin;
