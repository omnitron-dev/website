---
title: titan-pm
---

# titan-pm

Process manager: supervisors, worker pools, and worker handles for
running CPU-bound or isolated work in child processes.

## Install

```bash
pnpm add @omnitron-dev/titan-pm
```

## Setup

```typescript
import { PmModule } from '@omnitron-dev/titan-pm';

@Module({
  imports: [
    PmModule.forRoot({
      workers: {
        imageProcessor: {
          path:   './workers/image.worker.js',
          pool:   { min: 2, max: 8 },
          restartPolicy: 'on-failure',
        },
      },
    }),
  ],
})
export class AppModule {}
```

## Use

```typescript
@Service('media@1.0.0')
export class MediaService {
  constructor(private readonly pm: PmService) {}

  @Public()
  async resize(input: Buffer, width: number) {
    return this.pm.invoke('imageProcessor', 'resize', [input, width]);
  }
}
```

The PM service routes the call to a free worker, queues if all workers
are busy, and surfaces errors back to the caller as typed `WorkerError`.

## Lifecycle

- **Crash chain** — when a worker exits unexpectedly, the supervisor
  fires `onWorkerExit` and (if `restartPolicy: 'on-failure'`) restarts
  it with backoff.
- **PID liveness sweep** — the supervisor periodically reaps dead PIDs
  it can no longer reach, releasing their leases.
- **Bounded maps** — internal caches are size-bounded to prevent
  memory leaks under crash loops.

## Read also

- [titan-scheduler](./scheduler.md) — for time-based work, not pool-based.
- [titan-cache](./cache.md) — uses the same bounded-map and getOrSet primitives.
