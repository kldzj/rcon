import { createSocket, Socket, SocketType } from 'node:dgram';
import RconConnection, { RconConnectionOptions, RconPacketType } from '.';

export default class RconUDP extends RconConnection {
  protected timeout: number;
  protected connection?: Socket;
  protected challengeToken?: string;
  protected authCallback?: (value: this) => void;

  constructor(opts: RconConnectionOptions) {
    super(opts);
    this.timeout = opts.timeout ?? 5000;
  }

  public connect(type: SocketType = 'udp4'): Promise<this> {
    return new Promise<this>((resolve, reject) => {
      if (this.connection) {
        return reject(new Error('Already connected'));
      }

      this.connection = createSocket(type);
      this.connection.on('message', (data) => this.handleData(data));
      this.connection.on('error', (e) => this.emit('error', e));
      this.connection.once('close', () => this.handleEnd());
      this.connection.once('listening', () => {
        if (!this.connection) {
          return reject(new Error('Connection was closed'));
        }

        let buf: Buffer;
        if (this.challenge) {
          const cmd = 'challenge rcon\n';
          buf = Buffer.alloc(Buffer.byteLength(cmd) + 4);
          buf.writeInt32LE(-1, 0);
          buf.write(cmd, 4);
        } else {
          buf = Buffer.alloc(5);
          buf.writeInt32LE(-1, 0);
          buf.writeUInt8(0, 4);

          this.hasAuthed = true;
          this.emit('auth');
        }

        this.connection.send(buf, this.port, this.host, (err) => {
          if (err) {
            return reject(err);
          }

          if (this.challenge) {
            this.authCallback = resolve;
            setTimeout(() => reject(new Error('Timed out waiting for challenge token')), this.timeout);
          } else {
            resolve(this);
          }
        });
      });

      this.connection.bind(0);
    });
  }

  public disconnect(): Promise<this> {
    return new Promise<this>((resolve) => {
      if (!this.connection) {
        return resolve(this);
      }

      this.connection.close(() => resolve(this));
    });
  }

  public _send(data: string, _: RconPacketType): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      if (!this.connection) {
        return reject(new Error('Not connected'));
      }

      if (this.challenge && !this.challengeToken) {
        return reject(new Error('Not authenticated'));
      }

      let str = 'rcon ';
      if (this.challengeToken) {
        str += `${this.challengeToken} `;
      }

      if (this.password.length) {
        str += `${this.password} `;
      }

      str += `${data}\n`;

      const buf = Buffer.alloc(4 + Buffer.byteLength(str));
      buf.writeInt32LE(-1, 0);
      buf.write(str, 4);
      this.connection.send(buf, this.port, this.host, (err) => {
        if (err) {
          return reject(err);
        }

        resolve(data);
      });
    });
  }

  protected handleData(data: Buffer): void {
    if (data.readUInt32LE(0) === 0xffffffff) {
      const str = data.toString('utf8', 4);
      if (this.isChallengeTokenMsg(data)) {
        const rawToken = str.split(' ')[2];
        this.challengeToken = rawToken.substring(0, rawToken.length - 1).trim();
        this.authCallback?.(this);
        this.authCallback = undefined;
        this.hasAuthed = true;
        this.emit('auth');
      } else {
        this.emit('response', str.substring(1, str.length - 2));
      }
    } else {
      this.emit('error', new Error('Invalid packet'));
    }
  }

  protected isChallengeTokenMsg(data: Buffer): boolean {
    const str = data.toString('utf8', 4);
    const parts = str.split(' ');
    return data.readUInt32LE(0) === 0xffffffff && parts.length === 3 && parts[0] === 'challenge' && parts[1] === 'rcon';
  }
}
