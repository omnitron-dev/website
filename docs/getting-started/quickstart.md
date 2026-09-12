---
sidebar_position: 2
title: Quickstart
description: Compile a Titan service, bind an HTTP transport, and call it from a typed client.
---

# Your first service

Build a small service that reports its status, expose it over HTTP, and call
it from a separate process. You need **Node.js 22+** and a package manager.
No database, Docker or supervisor is required.

## 1. Create the project

```bash
mkdir signal-service
cd signal-service
pnpm init
pnpm add @omnitron-dev/titan @omnitron-dev/netron-browser
pnpm add -D typescript @types/node
mkdir src
```

Set `"type": "module"` in `package.json`. Keep the installed versions in your
lockfile. Create this compiler configuration:

```json title="tsconfig.json"
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "src",
    "outDir": "dist",
    "strict": true,
    "skipLibCheck": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "useDefineForClassFields": false
  },
  "include": ["src/**/*.ts"]
}
```

Compile with `tsc` so legacy decorators and their metadata are emitted.
Node's built-in TypeScript stripping does not compile those decorators.

## 2. Declare the service

```typescript title="src/signals.service.ts"
import { Service, Public } from '@omnitron-dev/titan/decorators';

@Service('signals@1.0.0')
export class SignalsService {
  @Public()
  async read(): Promise<{ status: string }> {
    return { status: 'online' };
  }
}
```

`@Service` gives the service its wire identity. `@Public()` exposes the
method to RPC callers. This example has no authentication and accepts no
arguments; it is intended to run on your local machine.

## 3. Register the module and transport

```typescript title="src/main.ts"
import { Application, Module } from '@omnitron-dev/titan';
import { HttpTransport } from '@omnitron-dev/titan/netron/transport/http';
import { SignalsService } from './signals.service.js';

@Module({ providers: [SignalsService] })
class AppModule {}

const app = await Application.create(AppModule);
const netron = app.netron;
if (!netron) throw new Error('Netron is unavailable');

netron.registerTransport('http', () => new HttpTransport());
netron.registerTransportServer('http', {
  name: 'api',
  options: { host: '127.0.0.1', port: 3000 },
});

await app.start();
console.log('Signals service ready at http://127.0.0.1:3000');
```

Register transports **before** `app.start()`. Registration stores the server
configuration; startup opens the listener and exposes service instances.
The application installs graceful shutdown handlers by default.

Compile and run:

```bash
pnpm exec tsc
node dist/main.js
```

Keep this terminal running. The readiness message appears after startup
completes. Stop the process with Ctrl+C when finished.

## 4. Make a typed call

```typescript title="src/client.ts"
import { createClient } from '@omnitron-dev/netron-browser';
import type { SignalsService } from './signals.service.js';

const client = createClient({ url: 'http://127.0.0.1:3000' });
try {
  await client.connect();
  const signals = client.service<SignalsService>('signals@1.0.0');
  console.log(await signals.read());
} finally {
  await client.disconnect();
}
```

In a second terminal, from the same project directory:

```bash
pnpm exec tsc
node dist/client.js
```

Expected output:

```text
{ status: 'online' }
```

The client imports only the service **type**; the backend implementation is
not included in the client at runtime.

## If it fails

| Symptom | Check |
| --- | --- |
| `EADDRINUSE` | Another process owns port 3000. Choose a free port in both files. |
| Connection refused | Start the server first and confirm its readiness message. |
| Service not found | Match `signals@1.0.0` exactly and register the class as a provider. |
| Decorator compilation error | Use the configuration above and compile with `tsc`. |
| `Netron is unavailable` | Keep Titan's core modules enabled for this example. |

## Extend the service

Add [validation](../titan/validation/overview.md) before accepting untrusted
inputs and [authentication](../titan/netron/authentication.md) before exposing
protected methods. Types alone enforce neither boundary.

Continue with the [application lifecycle](../titan/application/index.md),
[transport reference](../titan/netron/transports.md), or
[React bindings](../frontend/netron/react.md).
