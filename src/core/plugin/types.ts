import type { CloudflareAPI } from '../../services/CloudflareAPI.js';
import type { Task, TaskProgress } from '../../models/types.js';

// 任务执行上下文
export interface TaskContext {
  api: CloudflareAPI;
  task: Task;
  config: any;
  updateProgress: (progress: TaskProgress) => void;
}

// 任务执行结果
export interface TaskResult {
  success: boolean;
  data?: any;
  error?: string;
}

// 表单字段类型
export type FieldType = 'text' | 'textarea' | 'select' | 'number' | 'checkbox' | 'password';

// 表单字段定义
export interface FormField {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];
  defaultValue?: any;
}

// 表单 Schema
export interface FormSchema {
  fields: FormField[];
}

// 表格列定义
export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: any) => string;
}

// 资源插件接口
export interface ResourcePlugin {
  // 插件元信息
  name: string;
  displayName: string;
  description: string;
  resourceType: string;
  icon?: string;

  // CRUD 操作
  list(api: CloudflareAPI): Promise<any[]>;
  get?(api: CloudflareAPI, id: string): Promise<any>;
  create?(api: CloudflareAPI, data: any): Promise<any>;
  update?(api: CloudflareAPI, id: string, data: any): Promise<any>;
  delete?(api: CloudflareAPI, id: string): Promise<void>;

  // 任务类型定义
  getTaskTypes(): TaskTypeDefinition[];

  // UI 配置
  getListColumns(): TableColumn[];
  getCreateForm?(): FormSchema;
  getUpdateForm?(): FormSchema;
}

// 任务类型定义
export interface TaskTypeDefinition {
  type: string;
  displayName: string;
  description: string;
  configSchema: FormSchema;
  execute: (context: TaskContext) => Promise<TaskResult>;
}

// 验证结果
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}
