---
title: titan-notifications
---

# titan-notifications

Multi-channel notification delivery with backoff, dead-letter queues,
and Rotif-based reliable messaging.

## Install

```bash
pnpm add @omnitron-dev/titan-notifications
```

## Setup

```typescript
import { NotificationsModule } from '@omnitron-dev/titan-notifications';

@Module({
  imports: [
    NotificationsModule.forRoot({
      channels: {
        email:   { provider: 'smtp', config: { host, user, pass } },
        sms:     { provider: 'twilio', config: { sid, token } },
        webhook: { provider: 'http' },
      },
      retry: { maxAttempts: 5, baseDelayMs: 200 },
      dlq:   { redis: { url: env.REDIS_URL } },
    }),
  ],
})
export class AppModule {}
```

## Send

```typescript
@Service('notifications@1.0.0')
export class NotifyService {
  constructor(private readonly notify: NotificationService) {}

  @Public()
  async sendWelcome(user: User) {
    await this.notify.send({
      to:       user.email,
      channel:  'email',
      template: 'welcome',
      data:     { name: user.name },
    });
  }
}
```

## Dead-letter inspection

Failed deliveries land in the DLQ after `maxAttempts`. Inspect via the
CLI or the web console:

```bash
omnitron notify dlq list
omnitron notify dlq retry <id>
```
