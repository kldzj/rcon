This package aims to provide a simple and easy to use interface to the RCON TCP and UDP specifications.

## Installation

Using yarn:

```sh-session
$ yarn add @kldzj/rcon
```

Using npm:

```sh-session
$ npm i -S @kldzj/rcon
```

## Usage

```typescript
import { createConnection, RconProtocol } from '@kldzj/rcon';

const rcon = createConnection({
  host: '127.0.0.1',
  port: 27015,
  password: 'dQw4w9WgXcQ',
  protocol: RconProtocol.UDP,
  // or use RconProtocol.TCP (default)
  challenge: true, // make use of UDP challenge auth
});

// the only way to get responses when using UDP is to use the 'response' event
rcon.on('response', (str) => console.log(str));

await rcon.connect();

// when using TCP, the response is returned as a promise,
// while UDP will simply return the command you put in
const status = await rcon.send('status');

await rcon.send('quit');

// disconnect once you're done
await rcon.disconnect();
```
