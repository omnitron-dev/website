---
sidebar_position: 2
title: 1. Scaffold
description: Empty folder → working monorepo → "hello world" Titan app.
---

# Step 1 — Scaffold

By the end of this step: an empty folder turns into a pnpm
workspace with one Titan app saying hello.

## Create the monorepo

```bash
mkdir my-platform && cd my-platform
git init
echo "node_modules/" > .gitignore
echo "dist/" >> .gitignore
echo ".env" >> .gitignore
```

Initialise pnpm workspace:

```bash
pnpm init
```

Edit the generated `package.json`:

```json
{
  "name":    "my-platform",
  "private": true,
  "type":    "module",
  "scripts": {
    "dev":      "pnpm -F api dev",
    "build":    "pnpm -r build",
    "test":     "pnpm -r test"
  },
  "engines": { "node": ">=22" }
}
```

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

Create a root `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target":                       "ES2022",
    "module":                       "ESNext",
    "moduleResolution":             "bundler",
    "strict":                       true,
    "esModuleInterop":              true,
    "skipLibCheck":                 true,
    "isolatedModules":              true,
    "experimentalDecorators":       true,
    "emitDecoratorMetadata":        true,
    "useDefineForClassFields":      false,
    "lib":                          ["ES2022"],
    "resolveJsonModule":            true,
    "allowImportingTsExtensions":   false
  }
}
```

The decorator flags are mandatory for Titan.

## Create the first app

```bash
mkdir -p apps/api/src
cd apps/api
```

`apps/api/package.json`:

```json
{
  "name":    "api",
  "private": true,
  "type":    "module",
  "main":    "dist/main.js",
  "scripts": {
    "dev":   "pnpm build && node --watch dist/main.js",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/main.js"
  },
  "dependencies": {
    "@omnitron-dev/titan": "latest"
  },
  "devDependencies": {
    "@types/node": "latest",
    "typescript":  "latest"
  }
}
```

`apps/api/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir":  "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"]
}
```

## The first Titan app

`apps/api/src/main.ts`:

```typescript
import { Application, Module, Service } from '@omnitron-dev/titan';
import { HttpTransport } from '@omnitron-dev/titan/netron/transport/http';
import { Public } from '@omnitron-dev/titan/decorators';

// 1. A trivial service.
@Service('greetings@1.0.0')
class GreetingsService {
  @Public()
  async hello(name: string): Promise<string> {
    return `Hello, ${name}!`;
  }
}

// 2. Wire it in a module.
@Module({ providers: [GreetingsService] })
class AppModule {}

// 3. Boot.
const app = await Application.create(AppModule);
if (!app.netron) throw new Error('Netron is unavailable');
app.netron.registerTransport('http', () => new HttpTransport());
app.netron.registerTransportServer('http', {
  name: 'api',
  options: { port: 3001, host: '127.0.0.1' },
});
await app.start();
console.log('api ready on http://localhost:3001');

// Application installs graceful shutdown handlers by default.
```

Install + run:

```bash
cd ../..
pnpm install
pnpm dev
```

You should see:

```
api ready on http://localhost:3001
```

The development command compiles decorators with their metadata before
starting Node. In a second terminal, run `pnpm -F api exec tsc --watch`
to recompile edits; Node restarts when the emitted JavaScript changes.

## Verify

In another terminal, from the workspace root:

```bash
pnpm add -wD @omnitron-dev/netron-browser
node --input-type=module <<'JS'
import { createClient } from '@omnitron-dev/netron-browser';
const client = createClient({ url: 'http://127.0.0.1:3001' });
try {
  await client.connect();
  console.log(await client.invoke('greetings@1.0.0', 'hello', ['World']));
} finally {
  await client.disconnect();
}
JS
```

Output:

```text
Hello, World!
```

The service signature flowed through: the server `hello(name:
string): Promise<string>` is callable from anywhere that can
reach `:3001`.

## What just happened

The startup sequence has four explicit responsibilities:

| Your line | What it triggered |
| --------- | ----------------- |
| `@Service('greetings@1.0.0')` | Registered the class as a Netron RPC service identified by `greetings@1.0.0` |
| `@Public()` | Exposed the method on the wire (default: anonymous-allowed) |
| `@Module({providers: [...]})` | Registered the class with the DI container |
| `Application.create` → register transports → `app.start()` | Creates the module graph, then starts lifecycle hooks and opens the registered listener |

The setup provides:
- RPC with an explicit service identity
- ✓ MessagePack wire format
- ✓ DI container
- ✓ Lifecycle management
- ✓ Graceful shutdown wiring

## Commit

```bash
git add .
git commit -m "step 1: scaffold pnpm workspace + first Titan app"
```

## Next

**[Step 2 — Service →](./02-service.md)** — replace the hello
service with a real one backed by a database.

## Troubleshooting

| Symptom | Fix |
| ------- | --- |
| `Cannot use import statement outside a module` | Ensure `"type": "module"` in `apps/api/package.json` |
| `Decorators are not valid here` | Check `experimentalDecorators` + `emitDecoratorMetadata` in `tsconfig.json` |
| `EADDRINUSE :::3001` | Another process on 3001; choose a free port in the server and client |
| TypeScript errors on `@Service` | Run `pnpm install` again; ensure `@omnitron-dev/titan` resolved |
