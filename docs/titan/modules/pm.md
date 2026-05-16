---
title: titan-pm
---

# titan-pm

Process supervision, worker pools, IPC, graceful shutdown, restart
policies, and metrics/health monitoring.

```bash
pnpm add @omnitron-dev/titan-pm
```

## Setup

```typescript
import { ProcessManagerModule } from '@omnitron-dev/titan-pm';

@Module({
  imports: [
    ProcessManagerModule.forRoot({
      isolation:     'worker',          // 'worker' | 'fork'
      transport:     'unix',            // 'unix' | 'tcp'
      restartPolicy: {
        enabled:     true,
        maxRestarts: 5,
        window:      60_000,
        delay:       1_000,
        backoff:     'exponential',
      },
      resources: {
        maxMemory: 512 * 1024 * 1024,   // 512 MB
        maxCpu:    80,                  // %
        timeout:   30_000,
      },
      monitoring: {
        healthCheck: true,
        metrics:     true,
        tracing:     true,
      },
      advanced: {
        gracefulShutdownTimeout: 30_000,
      },
    }),
  ],
})
class AppModule {}
```

### `IProcessManagerConfig`

| Option         | Type / Default                                                  |
| -------------- | --------------------------------------------------------------- |
| `isolation`    | `'worker' \| 'fork'` (default `'worker'`)                       |
| `transport`    | `'unix' \| 'tcp'` (default `'unix'`)                            |
| `restartPolicy`| `{ enabled, maxRestarts, window, delay, backoff }`              |
| `resources`    | `{ maxMemory, maxCpu, timeout }`                                |
| `monitoring`   | `{ healthCheck, metrics, tracing }`                             |
| `testing`      | `{ useMockSpawner }`                                            |
| `advanced`     | `{ gracefulShutdownTimeout }`                                   |

## Decorators (16 in total)

### Process classes

| Decorator           | Effect                                              |
| ------------------- | --------------------------------------------------- |
| `@Process(options)` | Mark a class as a runnable process                  |
| `@Workflow(options)`| Mark a class as a workflow (orchestrates processes) |
| `@Actor()`          | Mark a class as an actor (message-passing)          |
| `@Supervisor(options)` | Mark a class as a supervisor                     |

### Method-level — process behaviour

| Decorator              | Effect                                                  |
| ---------------------- | ------------------------------------------------------- |
| `@Public()`            | Expose method over IPC                                  |
| `@Stage()`             | Workflow stage                                          |
| `@Compensate()`        | Workflow compensation handler                           |
| `@HealthCheck()`       | Mark a method as a health-check                         |
| `@OnShutdown()`        | Cleanup hook                                            |
| `@Child()`             | Mark a method that spawns child processes               |
| `@Trace()`             | Auto-trace span                                         |
| `@Metric()`            | Auto-instrument metric                                  |

### Method-level — resilience

| Decorator              | Effect                                                  |
| ---------------------- | ------------------------------------------------------- |
| `@CircuitBreaker()`    | Circuit-break the method                                |
| `@RateLimit()`         | Rate-limit the method                                   |
| `@Idempotent()`        | Idempotent method (safe to retry)                       |
| `@Validate()`          | Validate input                                          |
| `@Cache()`             | Cache the result                                        |

## Example — a worker pool

```typescript
import { Process, Public, OnShutdown } from '@omnitron-dev/titan-pm';

@Process({ pool: { min: 2, max: 8 } })
export class ImageWorker {
  @Public()
  async resize(input: Buffer, width: number) {
    return sharp(input).resize(width).toBuffer();
  }

  @OnShutdown()
  async cleanup() {
    // close handles, flush state
  }
}
```

```typescript
import { ProcessManager, PM_MANAGER_TOKEN } from '@omnitron-dev/titan-pm';

@Service({ name: 'media' })
class MediaService {
  constructor(@Inject(PM_MANAGER_TOKEN) private readonly pm: ProcessManager) {}

  @Public()
  async resize(input: Buffer, width: number) {
    return this.pm.invoke('ImageWorker', 'resize', [input, width]);
  }
}
```

## Exposed services

`ProcessManager`, `ProcessRegistry`, `ProcessSpawner`,
`ProcessSpawnerFactory`, `ProcessPool`, `ProcessSupervisor`,
`ProcessMetricsCollector`, `ProcessHealthChecker`.

## Exported tokens

| Token                  |
| ---------------------- |
| `PM_CONFIG_TOKEN`      |
| `PM_MANAGER_TOKEN`     |
| `PM_REGISTRY_TOKEN`    |
| `PM_SPAWNER_TOKEN`     |
| `PM_METRICS_TOKEN`     |
| `PM_HEALTH_TOKEN`      |
