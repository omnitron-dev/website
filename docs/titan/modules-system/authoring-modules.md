---
sidebar_position: 4
title: Authoring a module
description: How to build, package, and publish a Titan module to share with the community.
---

# Authoring a module

This is the canonical recipe for building a Titan module. Every
official `titan-*` package is built from this template, and any
community module worth adopting follows the same shape.

The goal is **a module that looks and behaves like an official one**:
typed `forRoot` options, lifecycle-aware services, exported tokens,
documented in the same shape, ready to drop into an existing
application without surprise.

## What "a module" means in Titan

A module is a class with a `@Module` decorator that:

1. **Declares providers** — services it contributes to the container.
2. **Declares exports** — providers visible to importers.
3. **Optionally provides a `forRoot` (and `forRootAsync`)** static
   factory that returns a `DynamicModule`, configuring its providers
   from caller-supplied options.

The pattern lets each Titan application compose its set of modules
with the configuration it needs — same code, different bindings.

## Package skeleton

Start from this layout:

```
my-titan-foo/
├── src/
│   ├── foo.module.ts          ← the @Module class + forRoot
│   ├── foo.service.ts         ← main service exposed to consumers
│   ├── foo.types.ts           ← public types (options, interfaces)
│   ├── foo.tokens.ts          ← DI tokens for every export
│   ├── foo.decorators.ts      ← optional: decorators if needed
│   └── index.ts               ← public barrel
├── package.json
├── tsconfig.json
└── README.md
```

### `package.json` essentials

```json
{
  "name": "@your-scope/titan-foo",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" }
  },
  "peerDependencies": {
    "@omnitron-dev/titan": "^0.1.0"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json"
  }
}
```

**Always** declare `@omnitron-dev/titan` as a `peerDependency` —
never as a regular dependency. Otherwise the consumer ends up with
two copies of the framework and DI breaks silently.

## Step 1 — define the options interface

Every module's `forRoot` accepts a single options bag. Put the
interface in `*.types.ts`:

```typescript
// src/foo.types.ts

export interface IFooModuleOptions {
  /** Required: API key for the upstream service */
  apiKey: string;

  /** Optional: request timeout in milliseconds */
  timeoutMs?: number;

  /** Optional: enable verbose logging */
  debug?: boolean;

  /** Optional: make module global */
  isGlobal?: boolean;
}

export interface IFooModuleAsyncOptions {
  imports?: any[];
  useFactory?: (...args: any[]) => Promise<IFooModuleOptions> | IFooModuleOptions;
  inject?: any[];
  isGlobal?: boolean;
}
```

Conventional naming:

- Interface name = `I` + module name + `ModuleOptions`
- Async variant = same + `Async`
- Every field documented with JSDoc
- Optionals end in `?`; required fields don't

## Step 2 — define the DI tokens

```typescript
// src/foo.tokens.ts

import { createToken } from '@omnitron-dev/titan/nexus';
import type { FooService } from './foo.service.js';
import type { IFooModuleOptions } from './foo.types.js';

export const FOO_SERVICE_TOKEN = createToken<FooService>('FooService');
export const FOO_OPTIONS_TOKEN = createToken<IFooModuleOptions>('FooOptions');
```

Tokens go in their own file so consumers can import them without
pulling in the implementation.

## Step 3 — write the service

```typescript
// src/foo.service.ts

import { Injectable, Inject } from '@omnitron-dev/titan';
import { LOGGER_SERVICE_TOKEN, type ILoggerModule }
  from '@omnitron-dev/titan/module/logger';
import { FOO_OPTIONS_TOKEN } from './foo.tokens.js';
import type { IFooModuleOptions } from './foo.types.js';

@Injectable()
export class FooService {
  private readonly logger;

  constructor(
    @Inject(FOO_OPTIONS_TOKEN)        private readonly options: IFooModuleOptions,
    @Inject(LOGGER_SERVICE_TOKEN)     loggerModule: ILoggerModule,
  ) {
    this.logger = loggerModule.getLogger().child({ context: 'FooService' });
  }

  async fetch(path: string): Promise<unknown> {
    if (this.options.debug) {
      this.logger.debug('fetch', { path });
    }
    // …actual work using this.options.apiKey, this.options.timeoutMs
  }

  // Lifecycle hooks — implement if the service holds external state
  async onInit(): Promise<void> {
    // E.g. validate credentials before serving traffic
  }

  async onDestroy(): Promise<void> {
    // E.g. close connections / drain queues
  }
}
```

**Key conventions:**

- `@Injectable()` so the container can resolve it.
- Inject the options bundle via the dedicated token; **never**
  inject `IFooModuleOptions` directly.
- Inject the logger so consumers can see what your module is doing.
- Implement lifecycle interfaces (`OnInit`, `OnStart`, `OnStop`,
  `OnDestroy`) if your service holds resources.

## Step 4 — write the module class

```typescript
// src/foo.module.ts

import { Module, type DynamicModule } from '@omnitron-dev/titan';
import { FOO_SERVICE_TOKEN, FOO_OPTIONS_TOKEN } from './foo.tokens.js';
import { FooService } from './foo.service.js';
import type { IFooModuleOptions, IFooModuleAsyncOptions } from './foo.types.js';

@Module({})
export class TitanFooModule {
  /**
   * Configure FooModule with static options.
   */
  static forRoot(options: IFooModuleOptions): DynamicModule {
    return {
      module: TitanFooModule,
      global: options.isGlobal,
      providers: [
        { provide: FOO_OPTIONS_TOKEN, useValue: options },
        { provide: FOO_SERVICE_TOKEN, useClass: FooService },
      ],
      exports: [FOO_SERVICE_TOKEN],
    };
  }

  /**
   * Configure FooModule with async options — resolves options via
   * a factory that can inject other providers.
   */
  static forRootAsync(options: IFooModuleAsyncOptions): DynamicModule {
    return {
      module: TitanFooModule,
      global: options.isGlobal,
      imports: options.imports,
      providers: [
        {
          provide:    FOO_OPTIONS_TOKEN,
          useFactory: options.useFactory!,
          inject:     options.inject ?? [],
        },
        { provide: FOO_SERVICE_TOKEN, useClass: FooService },
      ],
      exports: [FOO_SERVICE_TOKEN],
    };
  }
}
```

**`@Module({})` is intentionally empty** on the class — the
`forRoot`/`forRootAsync` methods produce a `DynamicModule` at call
time that contains the actual provider list.

## Step 5 — write the public barrel

```typescript
// src/index.ts

export { TitanFooModule } from './foo.module.js';
export { FooService } from './foo.service.js';
export type {
  IFooModuleOptions,
  IFooModuleAsyncOptions,
} from './foo.types.js';
export {
  FOO_SERVICE_TOKEN,
  FOO_OPTIONS_TOKEN,
} from './foo.tokens.js';

// Decorators, if any:
// export { Foo } from './foo.decorators.js';
```

Only export what's truly public. Internal helpers stay un-exported.

## Step 6 — write the consumer-facing README

The README is the public contract. Use this skeleton (the same
shape every official module uses):

```markdown
# @your-scope/titan-foo

> One-sentence description.

## Install

\`\`\`bash
pnpm add @your-scope/titan-foo @omnitron-dev/titan
\`\`\`

## Quickstart

\`\`\`typescript
import { TitanFooModule } from '@your-scope/titan-foo';

@Module({
  imports: [TitanFooModule.forRoot({ apiKey: env.FOO_API_KEY })],
})
class AppModule {}
\`\`\`

## Options

| Option       | Type     | Default | Description |
| ------------ | -------- | ------- | ----------- |
| `apiKey`     | string   | —       | …           |
| `timeoutMs`  | number   | 5000    | …           |

## Services

| Class         | Token                  | Purpose |
| ------------- | ---------------------- | ------- |
| `FooService`  | `FOO_SERVICE_TOKEN`    | …       |

## Lifecycle

…

## Anti-patterns

…
```

## Optional — async-options patterns

For modules whose options need to be loaded from `ConfigModule` or
another async source, `forRootAsync` supports several factories:

### `useFactory` (most common)

```typescript
TitanFooModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (config: ConfigService) => ({
    apiKey: config.get('foo.apiKey'),
  }),
  inject: [ConfigService],
})
```

### `useClass` — for factories with their own dependencies

```typescript
@Injectable()
export class FooOptionsFactory implements IFooOptionsFactory {
  constructor(private readonly config: ConfigService) {}

  createOptions(): IFooModuleOptions {
    return { apiKey: this.config.get('foo.apiKey') };
  }
}

TitanFooModule.forRootAsync({
  imports: [ConfigModule],
  useClass: FooOptionsFactory,
})
```

### `useExisting` — when the factory class is already provided

```typescript
TitanFooModule.forRootAsync({
  useExisting: SomeExistingFactory,
})
```

## Optional — decorators

If your module benefits from a decorator (e.g. `@FooCache`,
`@FooLog`), put it in `src/foo.decorators.ts`:

```typescript
// src/foo.decorators.ts

import { Inject } from '@omnitron-dev/titan';
import { FOO_SERVICE_TOKEN } from './foo.tokens.js';

export const InjectFoo = () => Inject(FOO_SERVICE_TOKEN);
```

Or for method-level decorators, follow the `createMethodInterceptor`
pattern from `@omnitron-dev/titan/decorators`.

## Optional — health indicator

If your module talks to an external dependency, ship a health
indicator so consumers can register it with
[`titan-health`](../modules/health.mdx):

```typescript
// src/foo.health.ts

import { Injectable } from '@omnitron-dev/titan';
import type { IHealthIndicator, HealthIndicatorResult }
  from '@omnitron-dev/titan-health';

@Injectable()
export class FooHealthIndicator implements IHealthIndicator {
  name = 'foo';

  constructor(private readonly foo: FooService) {}

  async check(): Promise<HealthIndicatorResult> {
    try {
      await this.foo.ping();
      return { status: 'healthy' };
    } catch (e) {
      return { status: 'unhealthy', message: String(e) };
    }
  }
}
```

Export it as `FooHealthIndicator` + `FOO_HEALTH_INDICATOR_TOKEN`.

## Module conventions checklist

When your module is ready to share, verify:

- [ ] `@omnitron-dev/titan` is a `peerDependency` (not `dependency`)
- [ ] Module class is named `TitanFooModule` (matches official naming)
- [ ] `forRoot(options)` returns `DynamicModule` with explicit
  `providers` / `exports`
- [ ] `forRootAsync(options)` exists if options can come from another module
- [ ] Every public export is in `index.ts`; nothing leaks via deep
  imports
- [ ] Every DI token is typed (`createToken<T>(name)`)
- [ ] The main service is `@Injectable()`
- [ ] Lifecycle hooks (`onInit`/`onStart`/`onStop`/`onDestroy`)
  implemented where state requires
- [ ] Options interface is fully documented with JSDoc
- [ ] README follows the official-module shape
- [ ] Health indicator exported if module owns an external dependency
- [ ] Test suite covers happy path + lifecycle + error cases

## Publishing

For npm publish:

```bash
pnpm build
npm publish --access public
```

For inclusion in the Titan documentation:

1. Add an entry under [Community Modules](../modules/community.mdx)
   with package URL + one-line purpose.
2. Open a PR against `omnitron-dev/omni` referencing your repo,
   the maintenance commitment, and links to docs / tests.

## Worked example — complete `titan-foo`

Putting it all together:

```typescript
// src/index.ts (final state)

export { TitanFooModule }       from './foo.module.js';
export { FooService }           from './foo.service.js';
export { FooHealthIndicator }   from './foo.health.js';

export {
  FOO_SERVICE_TOKEN,
  FOO_OPTIONS_TOKEN,
  FOO_HEALTH_INDICATOR_TOKEN,
} from './foo.tokens.js';

export type {
  IFooModuleOptions,
  IFooModuleAsyncOptions,
} from './foo.types.js';

export { InjectFoo } from './foo.decorators.js';
```

Consumer:

```typescript
import { TitanFooModule, InjectFoo, type FooService } from '@your-scope/titan-foo';

@Module({
  imports: [TitanFooModule.forRoot({ apiKey: env.FOO_API_KEY })],
  providers: [MyService],
})
class AppModule {}

@Injectable()
class MyService {
  constructor(@InjectFoo() private readonly foo: FooService) {}

  async fetchSomething() {
    return this.foo.fetch('/data');
  }
}
```

A consumer using your module shouldn't be able to tell whether it's
official or community. That's the bar.

## See also

- [Modules system / Defining modules](./defining-modules.md) — module
  fundamentals
- [Modules system / Dynamic modules](./dynamic-modules.md) —
  forRoot / forRootAsync patterns
- [Community modules](../modules/community.mdx) — how to register
  your module in the catalogue
- [Testing / Modules](../testing/modules.md) — write tests for your
  module that consumers can rely on
