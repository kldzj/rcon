export interface QueuedRconPacket {
  resolve: (value: string) => void;
  reject: (reason: Error) => void;
  queued: Array<Uint8Array>;
  finalizer: number;
  timeout?: number;
  length: number;
}

export default class RconPacketQueue {
  protected queue: Record<number, QueuedRconPacket>;
  protected currentId: number = 0;
  protected idCounter: number = 0;
  protected timeout: number;

  constructor(timeout: number = 5000) {
    this.timeout = timeout;
    this.queue = {};
  }

  public add(id: number, resolve: (value: string) => void, reject: (reason: Error) => void, timeout?: number): number {
    const finalizer = this.getNextId();
    this.queue[id] = {
      resolve,
      reject,
      finalizer,
      queued: [],
      length: -1,
      timeout,
    };

    if (timeout ?? this.timeout > 0) {
      setTimeout(() => {
        if (this.queue[id]) {
          this.reject(id, new Error('Timeout'));
        }
      }, timeout ?? this.timeout);
    }

    return finalizer;
  }

  public queuePacket(packet: Uint8Array): void {
    if (!this.queue[this.currentId]) {
      throw new Error(`No packet with id ${this.currentId} in queue`);
    }

    this.queue[this.currentId].queued.push(packet);
  }

  public resolveCurrent(data: string): void {
    if (this.queue[this.currentId]) {
      this.queue[this.currentId].resolve(data);
      delete this.queue[this.currentId];
    }
  }

  public reject(id: number, err: Error): void {
    if (this.queue[id]) {
      this.queue[id].reject(err);
      delete this.queue[id];
    }
  }

  public getNextId(): number {
    if (this.idCounter + 1 > Math.pow(2, 31) - 1) {
      this.idCounter = 0;
    }

    return ++this.idCounter;
  }

  public getLength(id: number = this.currentId): number {
    return this.queue[id]?.length ?? 0;
  }

  public getQueued(id: number = this.currentId): Array<Uint8Array> {
    return this.queue[id]?.queued ?? [];
  }

  public getQueuedSize(id: number = this.currentId): number {
    return this.queue[id]?.queued.reduce((acc, val) => acc + val.length, 0) ?? 0;
  }

  public getCurrentId(): number {
    return this.currentId;
  }

  public isFinalizerId(id: number = this.currentId): boolean {
    return Boolean(Object.values(this.queue).find((packet) => packet.finalizer === id));
  }

  public setCurrent(id: number = 0, length: number = 0): void {
    this.currentId = id;
    if (this.queue[this.currentId]) {
      this.queue[this.currentId].length = length;
    }
  }
}
