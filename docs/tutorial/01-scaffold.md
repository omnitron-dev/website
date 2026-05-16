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
  "main":    "dist/index.js",
  "scripts": {
    "dev":   "tsx watch src/main.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/main.js"
  },
  "dependencies": {
    "@omnitron-dev/titan": "latest"
  },
  "devDependencies": {
    "tsx":         "latest",
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
import { Application, Module, Injectable, Service, Public } from '@omnitron-dev/titan';

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
const app = await Application.create(AppModule, {
  netron: {
    http: { port: 3001, host: '0.0.0.0' },
  },
});

await app.start();
console.log('api ready on http://localhost:3001');

// Graceful shutdown
process.on('SIGTERM', () => app.stop());
process.on('SIGINT',  () => app.stop());
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

## Verify

In another terminal:

```bash
curl -X POST http://localhost:3001/netron \
  -H 'Content-Type: application/msgpack' \
  -d '...' # MessagePack-encoded RPC call
```

Easier — use the client we'll build in step 4. For now, install
the CLI tool to test:

```bash
pnpm add -wD @omnitron-dev/netron-browser

node -e "
const { createClient } = require('@omnitron-dev/netron-browser');
(async () => {
  const c = createClient({ url: 'http://localhost:3001' });
  await c.connect();
  console.log(await c.invoke('greetings', 'hello', ['World']));
})();
"
```

Output:

```text
Hello, World!
```

The service signature flowed through: the server `hello(name:
string): Promise<string>` is callable from anywhere that can
reach `:3001`.

## What just happened

Three lines you wrote, four things the framework did:

| Your line | What it triggered |
| --------- | ----------------- |
| `@Service('greetings@1.0.0')` | Registered the class as a Netron RPC service identified by `greetings@1.0.0` |
| `@Public()` | Exposed the method on the wire (default: anonymous-allowed) |
| `@Module({providers: [...]})` | Registered the class with the DI container |
| `Application.create(AppModule, {netron})` | Spun up the container, started lifecycle hooks, bound the Netron HTTP listener |

The 4-line setup gave you:
- ✓ Type-safe RPC
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
| `EADDRINUSE :::3001` | Another process on 3001; change the port or kill the other process |
| TypeScript errors on `@Service` | Run `pnpm install` again; ensure `@omnitron-dev/titan` resolved |
