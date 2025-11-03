import { Router, Response } from 'express';
import { nanoid } from 'nanoid';
import Database from 'better-sqlite3';
import type { AuthRequest } from '../middleware/auth.js';
import type { ScriptTemplate, CreateTemplateRequest, UpdateTemplateRequest } from '../models/types.js';

export function createTemplatesRouter(db: Database.Database): Router {
  const router = Router();

  // 获取所有模板
  router.get('/', (req: AuthRequest, res: Response) => {
    try {
      const templates = db.prepare('SELECT * FROM script_templates ORDER BY updated_at DESC').all() as any[];
      const result: ScriptTemplate[] = templates.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        content: row.content,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 获取单个模板
  router.get('/:id', (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const row = db.prepare('SELECT * FROM script_templates WHERE id = ?').get(id) as any;

      if (!row) {
        return res.status(404).json({ error: '模板不存在' });
      }

      const template: ScriptTemplate = {
        id: row.id,
        name: row.name,
        description: row.description,
        content: row.content,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };

      res.json(template);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 创建模板
  router.post('/', (req: AuthRequest, res: Response) => {
    try {
      const body = req.body as CreateTemplateRequest;

      if (!body.name || !body.name.trim()) {
        return res.status(400).json({ error: '模板名称不能为空' });
      }

      if (!body.content || !body.content.trim()) {
        return res.status(400).json({ error: '脚本内容不能为空' });
      }

      const id = nanoid();
      const name = body.name.trim();
      const description = body.description?.trim() || null;
      const content = body.content.trim();

      try {
        db.prepare(`
          INSERT INTO script_templates (id, name, description, content, created_at, updated_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(id, name, description, content);

        const row = db.prepare('SELECT * FROM script_templates WHERE id = ?').get(id) as any;

        const template: ScriptTemplate = {
          id: row.id,
          name: row.name,
          description: row.description,
          content: row.content,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };

        res.status(201).json(template);
      } catch (error: any) {
        if (error.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({ error: '模板名称已存在' });
        }
        throw error;
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 更新模板
  router.put('/:id', (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const body = req.body as UpdateTemplateRequest;

      const existing = db.prepare('SELECT * FROM script_templates WHERE id = ?').get(id) as any;
      if (!existing) {
        return res.status(404).json({ error: '模板不存在' });
      }

      const updates: string[] = [];
      const values: any[] = [];

      if (body.name !== undefined) {
        const name = body.name.trim();
        if (!name) {
          return res.status(400).json({ error: '模板名称不能为空' });
        }
        updates.push('name = ?');
        values.push(name);
      }

      if (body.description !== undefined) {
        updates.push('description = ?');
        values.push(body.description?.trim() || null);
      }

      if (body.content !== undefined) {
        const content = body.content.trim();
        if (!content) {
          return res.status(400).json({ error: '脚本内容不能为空' });
        }
        updates.push('content = ?');
        values.push(content);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: '没有需要更新的字段' });
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      try {
        db.prepare(`
          UPDATE script_templates
          SET ${updates.join(', ')}
          WHERE id = ?
        `).run(...values);

        const row = db.prepare('SELECT * FROM script_templates WHERE id = ?').get(id) as any;

        const template: ScriptTemplate = {
          id: row.id,
          name: row.name,
          description: row.description,
          content: row.content,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };

        res.json(template);
      } catch (error: any) {
        if (error.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({ error: '模板名称已存在' });
        }
        throw error;
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 删除模板
  router.delete('/:id', (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const existing = db.prepare('SELECT * FROM script_templates WHERE id = ?').get(id) as any;
      if (!existing) {
        return res.status(404).json({ error: '模板不存在' });
      }

      db.prepare('DELETE FROM script_templates WHERE id = ?').run(id);

      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
