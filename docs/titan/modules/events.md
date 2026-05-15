---
title: titan-events
---

# titan-events

In-process event bus with decorators, schema validation, and scheduled
delivery.

## Install

```bash
pnpm add @omnitron-dev/titan-events
```

## Setup

```typescript
import { EventsModule } from '@omnitron-dev/titan-events';

@Module({ imports: [EventsModule] })
export class AppModule {}
```

## Publish

```typescript
import { EventBus } from '@omnitron-dev/titan-events';

@Service('users@1.0.0')
export class UsersService {
  constructor(private readonly events: EventBus) {}

  @Public()
  async create(email: string) {
    const user = await this.repo.create({ email });
    await this.events.emit('user.created', { id: user.id, email });
    return user;
  }
}
```

## Subscribe

```typescript
@Injectable()
export class WelcomeMailer {
  @OnEvent('user.created', { schema: UserCreatedSchema })
  async send(event: UserCreated) {
    await this.mailer.send(event.email, 'Welcome to the system');
  }
}
```

The `schema` argument validates the event payload before the handler
runs; a schema mismatch becomes a `ValidationError` logged on the bus.

## Delayed delivery

```typescript
await this.events.emit('user.welcome-followup', payload, {
  delayMs: 24 * 60 * 60 * 1000,
});
```

For cross-process delivery, layer this module on top of [titan-notifications](./notifications.md)
or wire it through Redis pub/sub.
