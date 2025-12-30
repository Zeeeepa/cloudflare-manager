import type {
  ResourcePlugin,
  TaskTypeDefinition,
  TaskContext,
  TaskResult,
  TableColumn,
  FormSchema,
} from '../../core/plugin/index.js';
import type { CloudflareAPI } from '../../services/CloudflareAPI.js';

// Workers 插件实现
export const workersPlugin: ResourcePlugin = {
  name: 'workers',
  displayName: 'Workers',
  description: 'Cloudflare Workers 脚本管理',
  resourceType: 'workers',
  icon: 'code',

  // 列出所有 Workers
  async list(api: CloudflareAPI): Promise<any[]> {
    const workers = await api.listWorkers();
    const subdomain = await api.getSubdomain();
    return workers.map(w => ({
      ...w,
      url: `https://${w.id}.${subdomain}.workers.dev`,
      subdomain,
    }));
  },

  // 获取单个 Worker
  async get(api: CloudflareAPI, name: string): Promise<any> {
    const workers = await api.listWorkers();
    const worker = workers.find(w => w.id === name);
    if (!worker) {
      throw new Error(`Worker ${name} not found`);
    }
    const subdomain = await api.getSubdomain();
    return {
      ...worker,
      url: `https://${name}.${subdomain}.workers.dev`,
      subdomain,
    };
  },

  // 删除 Worker
  async delete(api: CloudflareAPI, name: string): Promise<void> {
    await api.deleteWorker(name);
  },

  // 任务类型定义
  getTaskTypes(): TaskTypeDefinition[] {
    return [
      createTaskType,
      updateTaskType,
      deleteTaskType,
      queryTaskType,
      listTaskType,
    ];
  },

  // 列表列定义
  getListColumns(): TableColumn[] {
    return [
      { key: 'id', label: '名称', sortable: true },
      { key: 'url', label: 'URL' },
      { key: 'modified_on', label: '修改时间', sortable: true },
      { key: 'created_on', label: '创建时间', sortable: true },
    ];
  },

  // 创建表单
  getCreateForm(): FormSchema {
    return {
      fields: [
        { name: 'workerName', label: 'Worker 名称', type: 'text', required: true },
        { name: 'script', label: '脚本内容', type: 'textarea', required: true },
        { name: 'compatibilityDate', label: '兼容日期', type: 'text', defaultValue: '2025-01-01' },
      ],
    };
  },

  // 更新表单
  getUpdateForm(): FormSchema {
    return {
      fields: [
        { name: 'script', label: '脚本内容', type: 'textarea', required: true },
        { name: 'compatibilityDate', label: '兼容日期', type: 'text' },
      ],
    };
  },
};

// 创建 Worker 任务
const createTaskType: TaskTypeDefinition = {
  type: 'create',
  displayName: '创建 Worker',
  description: '创建新的 Worker 并部署脚本',
  configSchema: {
    fields: [
      { name: 'workerName', label: 'Worker 名称', type: 'text', required: true },
      { name: 'script', label: '脚本内容', type: 'textarea', required: true },
      { name: 'compatibilityDate', label: '兼容日期', type: 'text', defaultValue: '2025-01-01' },
    ],
  },
  async execute(context: TaskContext): Promise<TaskResult> {
    const { api, config, updateProgress } = context;

    updateProgress({ step: '创建 Worker', current: 1, total: 3 });
    const workerId = await api.createWorker(config.workerName);

    updateProgress({ step: '上传脚本', current: 2, total: 3 });
    const versionId = await api.uploadWorkerScript(
      workerId,
      config.workerName,
      config.script,
      config.compatibilityDate,
      config.bindings
    );

    updateProgress({ step: '部署', current: 3, total: 3 });
    const deploymentId = await api.deployWorker(config.workerName, versionId);

    const subdomain = await api.getSubdomain();
    const url = `https://${config.workerName}.${subdomain}.workers.dev`;

    return {
      success: true,
      data: { workerId, versionId, deploymentId, url },
    };
  },
};

// 更新 Worker 任务
const updateTaskType: TaskTypeDefinition = {
  type: 'update',
  displayName: '更新 Worker',
  description: '更新现有 Worker 的脚本',
  configSchema: {
    fields: [
      { name: 'workerName', label: 'Worker 名称', type: 'text', required: true },
      { name: 'script', label: '脚本内容', type: 'textarea', required: true },
      { name: 'compatibilityDate', label: '兼容日期', type: 'text' },
    ],
  },
  async execute(context: TaskContext): Promise<TaskResult> {
    const { api, config, updateProgress } = context;

    updateProgress({ step: '查找 Worker', current: 1, total: 3 });
    const workers = await api.listWorkers();
    const worker = workers.find(w => w.id === config.workerName);
    if (!worker) {
      return { success: false, error: `Worker ${config.workerName} not found` };
    }

    updateProgress({ step: '上传新脚本', current: 2, total: 3 });
    const versionId = await api.uploadWorkerScript(
      worker.id,
      config.workerName,
      config.script,
      config.compatibilityDate,
      config.bindings
    );

    updateProgress({ step: '部署新版本', current: 3, total: 3 });
    const deploymentId = await api.deployWorker(config.workerName, versionId);

    return {
      success: true,
      data: { versionId, deploymentId },
    };
  },
};

// 删除 Worker 任务
const deleteTaskType: TaskTypeDefinition = {
  type: 'delete',
  displayName: '删除 Worker',
  description: '删除指定的 Worker',
  configSchema: {
    fields: [
      { name: 'workerName', label: 'Worker 名称', type: 'text', required: true },
    ],
  },
  async execute(context: TaskContext): Promise<TaskResult> {
    const { api, config, updateProgress } = context;

    updateProgress({ step: '查找 Worker', current: 1, total: 2 });
    const workers = await api.listWorkers();
    const worker = workers.find(w => w.id === config.workerName);
    if (!worker) {
      return { success: false, error: `Worker ${config.workerName} not found` };
    }

    updateProgress({ step: '删除 Worker', current: 2, total: 2 });
    await api.deleteWorker(worker.id);

    return { success: true, data: { deleted: true } };
  },
};

// 查询 Worker 任务
const queryTaskType: TaskTypeDefinition = {
  type: 'query',
  displayName: '查询 Worker',
  description: '查询指定 Worker 的信息',
  configSchema: {
    fields: [
      { name: 'workerName', label: 'Worker 名称', type: 'text', required: true },
    ],
  },
  async execute(context: TaskContext): Promise<TaskResult> {
    const { api, config, updateProgress } = context;

    updateProgress({ step: '查询 Worker', current: 1, total: 2 });
    const workers = await api.listWorkers();
    const worker = workers.find(w => w.id === config.workerName);

    if (!worker) {
      return { success: true, data: { found: false } };
    }

    updateProgress({ step: '获取子域', current: 2, total: 2 });
    const subdomain = await api.getSubdomain();
    const url = `https://${config.workerName}.${subdomain}.workers.dev`;

    return {
      success: true,
      data: { found: true, worker, url },
    };
  },
};

// 列出所有 Workers 任务
const listTaskType: TaskTypeDefinition = {
  type: 'list',
  displayName: '列出 Workers',
  description: '列出账号下所有 Workers',
  configSchema: { fields: [] },
  async execute(context: TaskContext): Promise<TaskResult> {
    const { api, updateProgress } = context;

    updateProgress({ step: '获取 Workers 列表', current: 1, total: 2 });
    const workers = await api.listWorkers();

    updateProgress({ step: '获取子域', current: 2, total: 2 });
    const subdomain = await api.getSubdomain();

    const workersWithUrls = workers.map(w => ({
      id: w.id,
      url: `https://${w.id}.${subdomain}.workers.dev`,
      created_on: w.created_on,
      modified_on: w.modified_on,
      etag: w.etag,
    }));

    return {
      success: true,
      data: { subdomain, count: workers.length, workers: workersWithUrls },
    };
  },
};

export default workersPlugin;
