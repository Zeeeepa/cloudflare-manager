import { ofetch } from 'ofetch';
import type { Account, AccountAuth, CFApiResponse, CFWorker, CFSubdomain, WorkerBinding } from '../models/types.js';

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';
const DEBUG = process.env.DEBUG_CF_API === 'true';
const REQUEST_TIMEOUT = 30000; // 30秒超时

// ANSI颜色码
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

export class CloudflareAPI {
  private accountId: string;
  private headers: Record<string, string>;
  private debugPrefix: string;

  constructor(account: Account | AccountAuth) {
    if ('authType' in account) {
      // Account对象
      this.accountId = account.accountId;
      this.debugPrefix = `[${account.accountId.substring(0, 8)}]`;
      this.headers = this.buildHeaders(account.authType, {
        apiToken: account.apiToken,
        authEmail: account.authEmail,
        authKey: account.authKey,
      });
    } else {
      // AccountAuth对象
      this.accountId = account.accountId;
      this.debugPrefix = `[${account.accountId.substring(0, 8)}]`;
      if (account.type === 'token') {
        this.headers = { 'Authorization': `Bearer ${account.apiToken}` };
      } else {
        this.headers = {
          'X-Auth-Email': account.authEmail,
          'X-Auth-Key': account.authKey,
        };
      }
    }
  }

  private debug(message: string, data?: any) {
    if (!DEBUG) return;
    console.log(`${colors.cyan}[CF API]${colors.reset} ${colors.gray}${this.debugPrefix}${colors.reset} ${message}`);
    if (data) {
      console.log(colors.gray + JSON.stringify(data, null, 2) + colors.reset);
    }
  }

  private maskSensitiveHeaders(headers: Record<string, string>): Record<string, string> {
    const masked = { ...headers };
    if (masked.Authorization) {
      masked.Authorization = 'Bearer ***';
    }
    if (masked['X-Auth-Key']) {
      masked['X-Auth-Key'] = '***';
    }
    return masked;
  }

  private async apiRequest<T>(url: string, options: any = {}): Promise<T> {
    const method = options.method || 'GET';
    const fullUrl = url.startsWith('http') ? url : `${CF_API_BASE}${url}`;

    // 安全地解析 body 用于调试日志
    let debugBody = options.body;
    if (typeof options.body === 'string') {
      try {
        debugBody = JSON.parse(options.body);
      } catch {
        // 如果不是有效的 JSON，保持原样（如纯文本）
        debugBody = options.body;
      }
    }

    this.debug(`${colors.blue}${method}${colors.reset} ${fullUrl}`, {
      headers: this.maskSensitiveHeaders(options.headers || this.headers),
      body: debugBody,
    });

    const startTime = Date.now();

    try {
      const response = await ofetch<T>(fullUrl, {
        ...options,
        headers: { ...this.headers, ...options.headers },
        timeout: REQUEST_TIMEOUT,
        retry: 0, // 不自动重试，避免长时间等待
      });

      const duration = Date.now() - startTime;
      this.debug(`${colors.green}✓${colors.reset} ${duration}ms`, response);

      return response;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.debug(`${colors.red}✗${colors.reset} ${duration}ms ${colors.red}ERROR${colors.reset}`, {
        message: error.message,
        data: error.data,
      });

      // 优先使用Cloudflare API返回的errors消息
      if (error.data?.errors && Array.isArray(error.data.errors) && error.data.errors.length > 0) {
        const cfError = error.data.errors[0];
        throw new Error(cfError.message || error.message);
      }

      throw error;
    }
  }

  private buildHeaders(
    authType: 'token' | 'email-key',
    creds: { apiToken?: string; authEmail?: string; authKey?: string }
  ): Record<string, string> {
    if (authType === 'token' && creds.apiToken) {
      return { 'Authorization': `Bearer ${creds.apiToken}` };
    } else if (authType === 'email-key' && creds.authEmail && creds.authKey) {
      return {
        'X-Auth-Email': creds.authEmail,
        'X-Auth-Key': creds.authKey,
      };
    }
    throw new Error('Invalid auth credentials');
  }

  // 1. 列出所有Workers
  async listWorkers(): Promise<CFWorker[]> {
    const response = await this.apiRequest<CFApiResponse<CFWorker[]>>(
      `/accounts/${this.accountId}/workers/scripts`
    );
    if (!response.success) {
      throw new Error(response.errors[0]?.message || 'Failed to list workers');
    }
    return response.result;
  }

  // 2. 创建Worker
  async createWorker(name: string): Promise<string> {
    const response = await this.apiRequest<CFApiResponse<{ id: string }>>(
      `/accounts/${this.accountId}/workers/workers`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          subdomain: { enabled: true },
          observability: { enabled: true },
        }),
      }
    );
    if (!response.success) {
      throw new Error(response.errors[0]?.message || 'Failed to create worker');
    }
    return response.result.id;
  }

  // 3. 上传Worker脚本
  async uploadWorkerScript(
    workerId: string,
    workerName: string,
    script: string,
    compatibilityDate: string = '2025-08-06',
    bindings: WorkerBinding[] = []
  ): Promise<string> {
    const scriptBase64 = Buffer.from(script).toString('base64');

    const body = {
      compatibility_date: compatibilityDate,
      main_module: `${workerName}.mjs`,
      modules: [
        {
          name: `${workerName}.mjs`,
          content_type: 'application/javascript+module',
          content_base64: scriptBase64,
        },
      ],
      bindings: bindings.map(b => this.formatBinding(b)),
    };

    const response = await this.apiRequest<CFApiResponse<{ id: string }>>(
      `/accounts/${this.accountId}/workers/workers/${workerId}/versions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
    if (!response.success) {
      throw new Error(response.errors[0]?.message || 'Failed to upload script');
    }
    return response.result.id; // version_id
  }

  // 4. 部署Worker
  async deployWorker(workerName: string, versionId: string): Promise<string> {
    const response = await this.apiRequest<CFApiResponse<{ id: string }>>(
      `/accounts/${this.accountId}/workers/scripts/${workerName}/deployments`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy: 'percentage',
          versions: [{ percentage: 100, version_id: versionId }],
        }),
      }
    );
    if (!response.success) {
      throw new Error(response.errors[0]?.message || 'Failed to deploy worker');
    }
    return response.result.id; // deployment_id
  }

  // 5. 删除Worker
  async deleteWorker(workerId: string): Promise<void> {
    const response = await this.apiRequest<CFApiResponse>(
      `/accounts/${this.accountId}/workers/workers/${workerId}`,
      { method: 'DELETE' }
    );
    if (!response.success) {
      throw new Error(response.errors[0]?.message || 'Failed to delete worker');
    }
  }

  // 6. 获取账号子域
  async getSubdomain(): Promise<string> {
    const response = await this.apiRequest<CFApiResponse<CFSubdomain>>(
      `/accounts/${this.accountId}/workers/subdomain`
    );
    if (!response.success) {
      throw new Error(response.errors[0]?.message || 'Failed to get subdomain');
    }
    return response.result.subdomain;
  }

  // 7. 下载Worker脚本
  async downloadWorkerScript(workerName: string): Promise<string> {
    const script = await this.apiRequest<string>(
      `/accounts/${this.accountId}/workers/scripts/${workerName}`,
      { responseType: 'text' }
    );
    return script;
  }

  // 完整的Worker创建流程（创建 -> 上传 -> 部署）
  async createAndDeployWorker(
    name: string,
    script: string,
    compatibilityDate?: string,
    bindings?: WorkerBinding[]
  ): Promise<{ workerId: string; versionId: string; deploymentId: string }> {
    const workerId = await this.createWorker(name);
    const versionId = await this.uploadWorkerScript(workerId, name, script, compatibilityDate, bindings);
    const deploymentId = await this.deployWorker(name, versionId);
    return { workerId, versionId, deploymentId };
  }

  // 更新Worker脚本（重新上传+部署）
  async updateWorkerScript(
    workerId: string,
    workerName: string,
    script: string,
    compatibilityDate?: string,
    bindings?: WorkerBinding[]
  ): Promise<{ versionId: string; deploymentId: string }> {
    const versionId = await this.uploadWorkerScript(workerId, workerName, script, compatibilityDate, bindings);
    const deploymentId = await this.deployWorker(workerName, versionId);
    return { versionId, deploymentId };
  }

  // 格式化绑定
  private formatBinding(binding: WorkerBinding): any {
    switch (binding.type) {
      case 'plain_text':
        return { type: 'plain_text', name: binding.name, text: binding.text };
      case 'secret_text':
        return { type: 'secret_text', name: binding.name, text: binding.text };
      case 'kv_namespace':
        return { type: 'kv_namespace', name: binding.name, namespace_id: binding.namespaceId };
      case 'd1':
        return { type: 'd1', name: binding.name, id: binding.databaseId };
      case 'r2_bucket':
        return { type: 'r2_bucket', name: binding.name, bucket_name: binding.bucketName };
      default:
        return binding;
    }
  }

  // 健康检查
  async healthCheck(): Promise<boolean> {
    try {
      await this.listWorkers();
      return true;
    } catch {
      return false;
    }
  }

  // ==================== KV Namespace API ====================

  // 列出所有 KV Namespaces
  async listKVNamespaces(): Promise<KVNamespace[]> {
    const response = await this.apiRequest<CFApiResponse<KVNamespace[]>>(
      `/accounts/${this.accountId}/storage/kv/namespaces`
    );
    if (!response.success) {
      throw new Error(response.errors[0]?.message || 'Failed to list KV namespaces');
    }
    return response.result;
  }

  // 创建 KV Namespace
  async createKVNamespace(title: string): Promise<KVNamespace> {
    const response = await this.apiRequest<CFApiResponse<KVNamespace>>(
      `/accounts/${this.accountId}/storage/kv/namespaces`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      }
    );
    if (!response.success) {
      throw new Error(response.errors[0]?.message || 'Failed to create KV namespace');
    }
    return response.result;
  }

  // 删除 KV Namespace
  async deleteKVNamespace(namespaceId: string): Promise<void> {
    const response = await this.apiRequest<CFApiResponse>(
      `/accounts/${this.accountId}/storage/kv/namespaces/${namespaceId}`,
      { method: 'DELETE' }
    );
    if (!response.success) {
      throw new Error(response.errors[0]?.message || 'Failed to delete KV namespace');
    }
  }

  // 重命名 KV Namespace
  async renameKVNamespace(namespaceId: string, title: string): Promise<void> {
    const response = await this.apiRequest<CFApiResponse>(
      `/accounts/${this.accountId}/storage/kv/namespaces/${namespaceId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      }
    );
    if (!response.success) {
      throw new Error(response.errors[0]?.message || 'Failed to rename KV namespace');
    }
  }

  // 列出 KV 键
  async listKVKeys(namespaceId: string, options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{ keys: KVKey[]; cursor?: string }> {
    const params = new URLSearchParams();
    if (options?.prefix) params.set('prefix', options.prefix);
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.cursor) params.set('cursor', options.cursor);

    const queryString = params.toString();
    const url = `/accounts/${this.accountId}/storage/kv/namespaces/${namespaceId}/keys${queryString ? '?' + queryString : ''}`;

    const response = await this.apiRequest<CFApiResponse<KVKey[]> & { result_info?: { cursor?: string } }>(url);
    if (!response.success) {
      throw new Error(response.errors[0]?.message || 'Failed to list KV keys');
    }
    return {
      keys: response.result,
      cursor: response.result_info?.cursor,
    };
  }

  // 读取 KV 值
  async getKVValue(namespaceId: string, key: string): Promise<string> {
    const value = await this.apiRequest<string>(
      `/accounts/${this.accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`,
      { responseType: 'text' }
    );
    return value;
  }

  // 写入 KV 值
  async putKVValue(namespaceId: string, key: string, value: string, options?: { expiration?: number; expirationTtl?: number; metadata?: any }): Promise<void> {
    const formData = new FormData();
    formData.append('value', value);
    if (options?.metadata) {
      formData.append('metadata', JSON.stringify(options.metadata));
    }

    const params = new URLSearchParams();
    if (options?.expiration) params.set('expiration', options.expiration.toString());
    if (options?.expirationTtl) params.set('expiration_ttl', options.expirationTtl.toString());

    const queryString = params.toString();
    const url = `/accounts/${this.accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}${queryString ? '?' + queryString : ''}`;

    const response = await this.apiRequest<CFApiResponse>(url, {
      method: 'PUT',
      body: value,
      headers: { 'Content-Type': 'text/plain' },
    });
    if (!response.success) {
      throw new Error(response.errors[0]?.message || 'Failed to put KV value');
    }
  }

  // 删除 KV 键
  async deleteKVKey(namespaceId: string, key: string): Promise<void> {
    const response = await this.apiRequest<CFApiResponse>(
      `/accounts/${this.accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`,
      { method: 'DELETE' }
    );
    if (!response.success) {
      throw new Error(response.errors[0]?.message || 'Failed to delete KV key');
    }
  }

  // 批量写入 KV
  async bulkWriteKV(namespaceId: string, kvPairs: Array<{ key: string; value: string; expiration?: number; expirationTtl?: number; metadata?: any }>): Promise<void> {
    const body = kvPairs.map(pair => ({
      key: pair.key,
      value: pair.value,
      expiration: pair.expiration,
      expiration_ttl: pair.expirationTtl,
      metadata: pair.metadata,
      base64: false,
    }));

    const response = await this.apiRequest<CFApiResponse>(
      `/accounts/${this.accountId}/storage/kv/namespaces/${namespaceId}/bulk`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
    if (!response.success) {
      throw new Error(response.errors[0]?.message || 'Failed to bulk write KV');
    }
  }

  // 批量删除 KV
  async bulkDeleteKV(namespaceId: string, keys: string[]): Promise<void> {
    const response = await this.apiRequest<CFApiResponse>(
      `/accounts/${this.accountId}/storage/kv/namespaces/${namespaceId}/bulk`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(keys),
      }
    );
    if (!response.success) {
      throw new Error(response.errors[0]?.message || 'Failed to bulk delete KV');
    }
  }

  // 获取 accountId（供插件使用）
  getAccountId(): string {
    return this.accountId;
  }
}

// KV 相关类型
export interface KVNamespace {
  id: string;
  title: string;
  supports_url_encoding?: boolean;
}

export interface KVKey {
  name: string;
  expiration?: number;
  metadata?: any;
}
