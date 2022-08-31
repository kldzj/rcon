import RconConnection, { RconConnectionOptions, RconProtocol } from './connection';
import RconTCP from './connection/tcp';
import RconUDP from './connection/udp';

export function createConnection(opts: RconConnectionOptions): RconConnection {
  const protocol = opts?.protocol ?? RconProtocol.TCP;
  switch (protocol) {
    case RconProtocol.UDP:
      return new RconUDP(opts);
    case RconProtocol.TCP:
      return new RconTCP(opts);
    default:
      throw new Error(`Unknown protocol: ${protocol}`);
  }
}

export { RconProtocol, RconConnectionOptions, RconTCP, RconUDP };

export default createConnection;
