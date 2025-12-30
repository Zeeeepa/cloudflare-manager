import { EventEmitter } from 'events';
import type { Job, Task, TaskProgress, Account } from '../../models/types.js';

// 系统事件类型定义
export type SystemEventMap = {
  // Job 事件
  'job:created': { job: Job };
  'job:started': { jobId: string };
  'job:completed': { jobId: string; status: Job['status'] };
  'job:failed': { jobId: string; error: string };

  // Task 事件
  'task:started': { task: Task };
  'task:progress': { taskId: string; progress: TaskProgress };
  'task:completed': { task: Task };
  'task:failed': { taskId: string; error: string };

  // Account 事件
  'account:created': { account: Account };
  'account:updated': { account: Account };
  'account:deleted': { accountId: string };
  'account:verified': { accountId: string; success: boolean; error?: string };

  // 插件事件
  'plugin:registered': { resourceType: string; name: string };
  'plugin:unregistered': { resourceType: string };

  // 系统事件
  'system:startup': { timestamp: string };
  'system:shutdown': { timestamp: string };
};

export type SystemEventType = keyof SystemEventMap;

// 事件处理器类型
export type EventHandler<T extends SystemEventType> = (payload: SystemEventMap[T]) => void | Promise<void>;

// 事件总线类
class EventBusImpl {
  private emitter = new EventEmitter();
  private asyncHandlers: Map<string, Set<EventHandler<any>>> = new Map();

  constructor() {
    // 增加监听器上限
    this.emitter.setMaxListeners(100);
  }

  // 发送事件（同步）
  emit<T extends SystemEventType>(type: T, payload: SystemEventMap[T]): void {
    this.emitter.emit(type, payload);

    // 异步处理器
    const handlers = this.asyncHandlers.get(type);
    if (handlers) {
      for (const handler of handlers) {
        Promise.resolve(handler(payload)).catch(err => {
          console.error(`事件处理器错误 [${type}]:`, err);
        });
      }
    }
  }

  // 监听事件（同步）
  on<T extends SystemEventType>(type: T, handler: EventHandler<T>): void {
    this.emitter.on(type, handler);
  }

  // 监听事件（异步，不阻塞）
  onAsync<T extends SystemEventType>(type: T, handler: EventHandler<T>): void {
    if (!this.asyncHandlers.has(type)) {
      this.asyncHandlers.set(type, new Set());
    }
    this.asyncHandlers.get(type)!.add(handler);
  }

  // 一次性监听
  once<T extends SystemEventType>(type: T, handler: EventHandler<T>): void {
    this.emitter.once(type, handler);
  }

  // 移除监听器
  off<T extends SystemEventType>(type: T, handler: EventHandler<T>): void {
    this.emitter.off(type, handler);

    const handlers = this.asyncHandlers.get(type);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  // 移除所有监听器
  removeAllListeners(type?: SystemEventType): void {
    if (type) {
      this.emitter.removeAllListeners(type);
      this.asyncHandlers.delete(type);
    } else {
      this.emitter.removeAllListeners();
      this.asyncHandlers.clear();
    }
  }

  // 获取监听器数量
  listenerCount(type: SystemEventType): number {
    const syncCount = this.emitter.listenerCount(type);
    const asyncCount = this.asyncHandlers.get(type)?.size || 0;
    return syncCount + asyncCount;
  }
}

// 导出单例
export const eventBus = new EventBusImpl();

// 导出类型
export type { EventBusImpl as EventBus };
