import { Socket } from 'node:net';
import RconConnection, { RconConnectionOptions, RconPacketType } from '.';
import RconPacketQueue from './queue';

export default class RconTCP extends RconConnection {
  protected queue: RconPacketQueue;
  protected connection?: Socket;

  constructor(opts: RconConnectionOptions) {
    super(opts);
    this.queue = new RconPacketQueue(opts?.timeout);
  }

  public connect(): Promise<this> {
    return new Promise<this>((resolve, reject) => {
      if (this.connection) {
        return reject(new Error('Already connected'));
      }

      this.connection = new Socket();
      this.connection.on('data', (data) => this.handleData(data));
      this.connection.on('error', (e) => this.emit('error', e));
      this.connection.once('end', () => this.handleEnd());
      this.connection.connect({ host: this.host, port: this.port }, () => {
        this.send(this.password, RconPacketType.Auth)
          .then(() => resolve(this))
          .catch((e) => reject(e));
      });
    });
  }

  public disconnect(): Promise<this> {
    return new Promise<this>((resolve) => {
      if (!this.connection) {
        return resolve(this);
      }

      this.connection.end(() => {
        this.connection = undefined;
        resolve(this);
      });
    });
  }

  public send(data: string, type: RconPacketType = RconPacketType.Command, timeout?: number): Promise<string> {
    return this._send(data, type, timeout);
  }

  public _send(data: string, type: RconPacketType, timeout?: number): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      if (!this.connection) {
        return reject(new Error('Not connected'));
      }

      const id = this.queue.getNextId();
      const length = Buffer.byteLength(data);
      const buf = Buffer.alloc(14 + length);
      buf.writeInt32LE(10 + length, 0);
      buf.writeInt32LE(id, 4);
      buf.writeInt32LE(type, 8);
      buf.write(data, 12);
      buf.writeInt16LE(0, 12 + length);

      const finalizer = this.queue.add(id, resolve, reject, timeout);
      this.connection.write(buf, (err) => {
        if (err) reject(err);
      });

      const _buf = Buffer.alloc(14);
      _buf.writeInt32LE(10, 0);
      _buf.writeInt32LE(finalizer, 4);
      _buf.writeInt32LE(RconPacketType.ResponseValue, 8);
      _buf.writeInt16LE(0, 12);
      this.connection.write(_buf);
    });
  }

  protected handleData(data: Buffer): void {
    if (!data.length) return;
    if (this.isMultiPacketFinalizer(data)) {
      return this.finalizePacket(data);
    }

    if (!this.queue.getCurrentId()) {
      const length = data.readUInt32LE(0);
      const id = data.readUInt32LE(4);
      const type = data.readUInt8(8);
      if (!this.hasAuthed && type === RconPacketType.ResponseAuth) {
        this.hasAuthed = true;
        this.queue.setCurrent(id, length);
        this.finalizePacket(data);
        this.emit('auth');
      } else if (type === RconPacketType.ResponseValue) {
        this.queue.setCurrent(id, length);
        const packet = this.concatPacket(data);
        if (length >= 10 && packet.length >= length + 4) {
          this.finalizePacket(data);
        } else {
          this.queue.queuePacket(packet);
        }
      } else {
        this.emit('error', new Error('Unexpected packet type'));
      }
    } else {
      this.queue.queuePacket(data);
    }
  }

  protected concatPacket(data: Buffer): Buffer {
    const totalLength = this.queue.getQueuedSize() + data.length;
    return Buffer.concat([...this.queue.getQueued(), data], totalLength);
  }

  protected finalizePacket(data: Buffer): void {
    let res = this.concatPacket(data).toString('utf8', 12, 12 + this.queue.getLength());
    if (res.charAt(res.length - 1) === '\n') {
      res = res.substring(0, res.length - 1);
    }

    this.emit('response', res);
    this.queue.resolveCurrent(res);
    this.queue.setCurrent();
  }

  protected isMultiPacketFinalizer(data: Buffer): boolean {
    try {
      return (
        this.queue.isFinalizerId(data.readUInt32LE(4)) &&
        data.readUInt8(8) === RconPacketType.ResponseValue &&
        data.readUInt32LE(0) === 10
      );
    } catch (e) {
      return false;
    }
  }
}
