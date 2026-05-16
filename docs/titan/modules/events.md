---
title: titan-events
---

# titan-events

Typed event bus with wildcard patterns, schema validation, delayed
and cron-scheduled events, history with replay, and bounded queues.

```bash
pnpm add @omnitron-dev/titan-events
```

## Setup

```typescript
import { EventsModule } from '@omnitron-dev/titan-events';

@Module({
  imports: [
    EventsModule.forRoot({
      wildcard:           true,
      delimiter:          '.',
      maxListeners:       50,
      verboseMemoryLeak:  false,
      history:            { enabled: true, maxSize: 1_000, ttl: 60_000 },
    }),
  ],
})
class AppModule {}
```

### `IEventsModuleOptions`

| Option              | Type                                              |
| ------------------- | ------------------------------------------------- |
| `wildcard`          | `boolean` — enable `*` and `**` patterns          |
| `delimiter`         | `string` — namespace separator (default `.`)      |
| `maxListeners`      | `number`                                          |
| `verboseMemoryLeak` | `boolean`                                         |
| `history`           | `{ enabled, maxSize?, ttl? }` — replayable history |

## Decorators

| Decorator                          | Effect                                              |
| ---------------------------------- | --------------------------------------------------- |
| `@OnEvent({ event })`              | Subscribe to an event by name or pattern            |
| `@OnceEvent(event)`                | Subscribe once                                      |
| `@OnAnyEvent()`                    | Catch every event                                   |
| `@EmitEvent(event)`                | Method invocation auto-emits the event              |
| `@ScheduleEvent({ delay? \| cron? })` | Schedule an event to fire later                  |
| `@BatchEvents(options)`            | Batch events for one delivery                       |
| `@OnModuleEvent(event)`            | Subscribe to internal module events                 |
| `@EventEmitter(namespace?)`        | Class-level: bind an emitter with a namespace       |

## Publishing and consuming

```typescript
import { EventsService, EVENTS_SERVICE_TOKEN, OnEvent } from '@omnitron-dev/titan-events';

@Service({ name: 'users' })
class UsersService {
  constructor(@Inject(EVENTS_SERVICE_TOKEN) private readonly events: EventsService) {}

  @Public()
  async create(input: CreateInput) {
    const user = await this.repo.create(input);
    await this.events.emit('user.created', { id: user.id, email: user.email });
    return user;
  }
}

@Injectable()
class WelcomeMailer {
  @OnEvent({ event: 'user.created' })
  async send(payload: { id: string; email: string }) {
    await this.mailer.send(payload.email, 'Welcome');
  }
}
```

## Wildcards

With `wildcard: true`, patterns work:

```typescript
@OnEvent({ event: 'user.*' })    // matches user.created, user.deleted, etc.
@OnEvent({ event: 'user.**' })   // matches any nested suffix
```

## Scheduled delivery

```typescript
@ScheduleEvent({ delay: 24 * 60 * 60 * 1000 })
async welcomeFollowup() { /* … */ }

@ScheduleEvent({ cron: '0 9 * * *' })
async dailyReport() { /* … */ }
```

## History and replay

When `history.enabled: true`, recent events are buffered. Consult
`EventHistoryService` for replay APIs.

## Health indicator

`EventsHealthIndicator` is exported and registers automatically
with `TitanHealthModule` if both are loaded.

## Exposed services

`EventsService`, `EventBusService`, `EventHistoryService`,
`EventSchedulerService`, `EventValidationService`,
`EventsHealthIndicator`.

## Exported tokens

| Token                              | Purpose                              |
| ---------------------------------- | ------------------------------------ |
| `EVENTS_SERVICE_TOKEN`             | Default events service               |
| `EVENT_EMITTER_TOKEN`              | Raw emitter                          |
| `EVENT_BUS_SERVICE_TOKEN`          | Event bus                            |
| `EVENT_SCHEDULER_SERVICE_TOKEN`    | Scheduling service                   |
| `EVENT_VALIDATION_SERVICE_TOKEN`   | Schema validation service            |
| `EVENT_HISTORY_SERVICE_TOKEN`      | History service                      |
| `EVENT_OPTIONS_TOKEN`              | Options bundle                       |
