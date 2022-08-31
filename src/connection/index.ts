import { TypedEmitter } from 'tiny-typed-emitter';

export enum RconProtocol {
  TCP = 'tcp',
  UDP = 'udp',
}

export enum RconPacketType {
  ResponseValue = 0x00,
  ResponseAuth = 0x02,
  Command = 0x02,
  Auth = 0x03,
}

export interface RconConnectionOptions {
  host: string;
  port: number;
  password: string;
  /**
   * The protocol to use for the connection.
   * @default RconProtocol.TCP
   */
  protocol: RconProtocol;
  /**
   * Timeout, only used for TCP connections and for the UDP challenge auth.
   * @default 5000
   */
  timeout?: number;
  /**
   * Challenge token, only used for UDP connections.
   * @default true
   */
  challenge?: boolean;
}

export interface RconConnectionEvents {
  response: (data: string) => void;
  error: (err: Error) => void;
  connect: () => void;
  auth: () => void;
  end: () => void;
}

export default abstract class RconConnection extends TypedEmitter<RconConnectionEvents> {
  public readonly host: string;
  public readonly port: number;
  public readonly challenge: boolean;
  protected readonly password: string;
  protected hasAuthed: boolean = false;

  constructor(opts: RconConnectionOptions) {
    super();
    this.host = opts.host;
    this.port = opts.port;
    this.password = opts.password;
    this.challenge = opts?.challenge ?? true;
  }

  public abstract connect(): Promise<this>;

  public abstract disconnect(): Promise<this>;

  public send(data: string, type: RconPacketType = RconPacketType.Command): Promise<string> {
    return this._send(data, type);
  }

  public abstract _send(data: string, type: RconPacketType): Promise<string>;

  protected abstract handleData(data: Buffer): void;

  protected handleEnd() {
    this.hasAuthed = false;
    this.emit('end');
  }
}
