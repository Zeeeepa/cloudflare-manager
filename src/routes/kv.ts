import { Router } from 'express';
import type { Database } from 'better-sqlite3';
import { CloudflareAPI } from '../services/CloudflareAPI.js';

export function createKVRouter(db: Database): Router {
  const router = Router();

  // 获取账号信息的辅助函数
  function getAccount(accountId: string) {
    const row = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId) as any;
    if (!row) {
      throw new Error('账号不存在');
    }
    // 映射数据库字段名 (snake_case) 到代码属性名 (camelCase)
    return {
      id: row.id,
      name: row.name,
      authType: row.auth_type,
      accountId: row.account_id,
      apiToken: row.api_token,
      authEmail: row.auth_email,
      authKey: row.auth_key,
      subdomain: row.subdomain,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // 列出指定账号的所有 KV Namespaces
  router.get('/namespaces', async (req, res) => {
    try {
      const { accountId } = req.query;
      console.log('[KV] GET /namespaces - accountId:', accountId);

      if (!accountId || typeof accountId !== 'string') {
        return res.status(400).json({ error: '缺少 accountId 参数' });
      }

      const account = getAccount(accountId);
      console.log('[KV] 找到账号:', account.name, '- CF accountId:', account.accountId);

      const api = new CloudflareAPI(account);
      console.log('[KV] 开始请求 Cloudflare API...');

      const namespaces = await api.listKVNamespaces();
      console.log('[KV] 获取到', namespaces.length, '个 namespaces');

      res.json(namespaces);
    } catch (error: any) {
      console.error('[KV] 错误:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // 创建 KV Namespace
  router.post('/namespaces', async (req, res) => {
    try {
      const { accountId, title } = req.body;
      if (!accountId || !title) {
        return res.status(400).json({ error: '缺少 accountId 或 title 参数' });
      }

      const account = getAccount(accountId);
      const api = new CloudflareAPI(account);
      const namespace = await api.createKVNamespace(title);

      res.json(namespace);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 删除 KV Namespace
  router.delete('/namespaces/:namespaceId', async (req, res) => {
    try {
      const { namespaceId } = req.params;
      const { accountId } = req.query;
      if (!accountId || typeof accountId !== 'string') {
        return res.status(400).json({ error: '缺少 accountId 参数' });
      }

      const account = getAccount(accountId);
      const api = new CloudflareAPI(account);
      await api.deleteKVNamespace(namespaceId);

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 重命名 KV Namespace
  router.put('/namespaces/:namespaceId', async (req, res) => {
    try {
      const { namespaceId } = req.params;
      const { accountId, title } = req.body;
      if (!accountId || !title) {
        return res.status(400).json({ error: '缺少 accountId 或 title 参数' });
      }

      const account = getAccount(accountId);
      const api = new CloudflareAPI(account);
      await api.renameKVNamespace(namespaceId, title);

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 列出 KV 键
  router.get('/namespaces/:namespaceId/keys', async (req, res) => {
    try {
      const { namespaceId } = req.params;
      const { accountId, prefix, limit, cursor } = req.query;
      if (!accountId || typeof accountId !== 'string') {
        return res.status(400).json({ error: '缺少 accountId 参数' });
      }

      const account = getAccount(accountId);
      const api = new CloudflareAPI(account);
      const result = await api.listKVKeys(namespaceId, {
        prefix: prefix as string | undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        cursor: cursor as string | undefined,
      });

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 获取 KV 值
  router.get('/namespaces/:namespaceId/values/:key', async (req, res) => {
    try {
      const { namespaceId, key } = req.params;
      const { accountId } = req.query;
      if (!accountId || typeof accountId !== 'string') {
        return res.status(400).json({ error: '缺少 accountId 参数' });
      }

      const account = getAccount(accountId);
      const api = new CloudflareAPI(account);
      const value = await api.getKVValue(namespaceId, key);

      res.json({ key, value });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 写入 KV 值
  router.put('/namespaces/:namespaceId/values/:key', async (req, res) => {
    try {
      const { namespaceId, key } = req.params;
      const { accountId, value, expirationTtl } = req.body;
      if (!accountId || value === undefined) {
        return res.status(400).json({ error: '缺少 accountId 或 value 参数' });
      }

      const account = getAccount(accountId);
      const api = new CloudflareAPI(account);
      await api.putKVValue(namespaceId, key, value, {
        expirationTtl: expirationTtl ? Number(expirationTtl) : undefined,
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 删除 KV 键
  router.delete('/namespaces/:namespaceId/values/:key', async (req, res) => {
    try {
      const { namespaceId, key } = req.params;
      const { accountId } = req.query;
      if (!accountId || typeof accountId !== 'string') {
        return res.status(400).json({ error: '缺少 accountId 参数' });
      }

      const account = getAccount(accountId);
      const api = new CloudflareAPI(account);
      await api.deleteKVKey(namespaceId, key);

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 批量写入 KV
  router.put('/namespaces/:namespaceId/bulk', async (req, res) => {
    try {
      const { namespaceId } = req.params;
      const { accountId, kvPairs } = req.body;
      if (!accountId || !kvPairs || !Array.isArray(kvPairs)) {
        return res.status(400).json({ error: '缺少 accountId 或 kvPairs 参数' });
      }

      const account = getAccount(accountId);
      const api = new CloudflareAPI(account);
      await api.bulkWriteKV(namespaceId, kvPairs);

      res.json({ success: true, count: kvPairs.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 批量删除 KV (使用 POST 避免 DELETE body 兼容性问题)
  router.post('/namespaces/:namespaceId/bulk-delete', async (req, res) => {
    try {
      const { namespaceId } = req.params;
      const { accountId, keys } = req.body;
      if (!accountId || !keys || !Array.isArray(keys)) {
        return res.status(400).json({ error: '缺少 accountId 或 keys 参数' });
      }

      const account = getAccount(accountId);
      const api = new CloudflareAPI(account);
      await api.bulkDeleteKV(namespaceId, keys);

      res.json({ success: true, count: keys.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
