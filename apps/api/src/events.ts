import { Injectable, OnModuleDestroy } from '@nestjs/common';
export type StreamEvent = {
  id: string;
  type:
    | 'snapshot'
    | 'sample'
    | 'event'
    | 'health'
    | 'incident.opened'
    | 'incident.updated'
    | 'incident.resolved'
    | 'alert.created'
    | 'alert.acknowledged'
    | 'alert-rule.updated';
  data: unknown;
};
@Injectable()
export class EventHub implements OnModuleDestroy {
  private readonly listeners = new Set<(event: StreamEvent) => void>();
  private readonly history: StreamEvent[] = [];
  private nextId = 1;
  private readonly heartbeat = setInterval(
    () => this.publish({ type: 'health', data: { status: 'heartbeat' } }),
    15000,
  );
  subscribe(listener: (event: StreamEvent) => void, afterId?: string): () => void {
    if (this.listeners.size >= 100) return () => undefined;
    this.listeners.add(listener);
    if (afterId)
      this.history.filter((event) => Number(event.id) > Number(afterId)).forEach(listener);
    return () => this.listeners.delete(listener);
  }
  publish(event: Omit<StreamEvent, 'id'> & { id?: string }): void {
    const withId = { ...event, id: event.id ?? String(this.nextId++) };
    this.history.push(withId);
    if (this.history.length > 100) this.history.shift();
    this.listeners.forEach((listener) => {
      try {
        listener(withId);
      } catch {
        this.listeners.delete(listener);
      }
    });
  }
  onModuleDestroy(): void {
    clearInterval(this.heartbeat);
    this.listeners.clear();
  }
}
