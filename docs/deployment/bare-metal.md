---
sidebar_position: 5
title: Bare-metal / systemd
description: Run Omnitron as a systemd service on your own server.
---

# Bare-metal / systemd

For when you own the server — bare-metal hardware, VPS, or a
VM you SSH into. systemd as the supervisor of the Omnitron
daemon; Omnitron supervises the Titan apps.

## Topology

```mermaid
flowchart TB
  System[systemd]
  System -- spawns + monitors --> Daemon[omnitron daemon]
  Daemon -- forks + supervises --> Apps[Titan apps]
  Apps --> PG[(Postgres)]
  Apps --> Redis[(Redis)]
```

systemd = OS-level supervisor. Omnitron = app-level
supervisor. Each does its job.

## Prerequisites

```bash
# Node.js 22+ (via nvm or apt):
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# pnpm:
sudo npm install -g pnpm

# Postgres + Redis (or managed elsewhere):
sudo apt install -y postgresql redis

# Optional but nice — a dedicated user:
sudo useradd -r -m -s /bin/bash omnitron
sudo -u omnitron mkdir -p /home/omnitron/.omnitron
```

## Ship the build

```bash
# On the build host:
pnpm install --frozen-lockfile
pnpm build
tar -czf platform.tar.gz dist apps packages omnitron.config.ts package.json pnpm-lock.yaml

# To the server:
scp platform.tar.gz omnitron@server:/home/omnitron/
ssh omnitron@server
tar -xzf platform.tar.gz -C /home/omnitron/platform/
cd /home/omnitron/platform
pnpm install --frozen-lockfile --prod
```

For mature shops, replace with a real deploy pipeline
(`omnitron deploy build` + scp + atomic symlink swap).

## systemd unit

Create `/etc/systemd/system/omnitron.service`:

```ini
[Unit]
Description=Omnitron supervisor
Documentation=https://omnitron.dev/docs
After=network-online.target postgresql.service redis.service
Wants=network-online.target

[Service]
Type=notify
User=omnitron
Group=omnitron
WorkingDirectory=/home/omnitron/platform

# Environment from a file (do NOT commit this file):
EnvironmentFile=/etc/omnitron/env

# Boot the daemon in foreground; systemd handles restart:
ExecStart=/usr/bin/pnpm omnitron up --foreground

# Graceful shutdown — give time for in-flight requests to drain:
KillSignal=SIGTERM
TimeoutStopSec=60
KillMode=mixed

Restart=on-failure
RestartSec=5s
StartLimitInterval=60s
StartLimitBurst=5

# Hardening:
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/home/omnitron/.omnitron /var/log/omnitron
PrivateTmp=yes
PrivateDevices=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictSUIDSGID=yes

# Resource limits:
LimitNOFILE=65536
MemoryMax=4G
CPUQuota=200%       # 2 cores

[Install]
WantedBy=multi-user.target
```

Environment file `/etc/omnitron/env`:

```bash
NODE_ENV=production
DATABASE_URL=postgres://platform:strongpass@localhost:5432/platform
REDIS_URL=redis://localhost:6379
JWT_SECRET=<generated>
OMNITRON_HOME=/home/omnitron/.omnitron
```

Set restrictive perms:

```bash
sudo chmod 0600 /etc/omnitron/env
sudo chown omnitron:omnitron /etc/omnitron/env
```

## Enable + start

```bash
sudo systemctl daemon-reload
sudo systemctl enable omnitron
sudo systemctl start omnitron

# Watch logs:
sudo journalctl -u omnitron -f
```

The Omnitron daemon writes its own log to
`~/.omnitron/logs/daemon.log`; journald captures stdout/stderr
as a backup.

## Database setup

```bash
sudo -u postgres psql <<'SQL'
CREATE USER platform WITH PASSWORD 'strongpass';
CREATE DATABASE platform OWNER platform;
GRANT ALL PRIVILEGES ON DATABASE platform TO platform;
SQL

# Migrate:
sudo -u omnitron bash -c 'cd /home/omnitron/platform && pnpm omnitron infra migrate'
```

For better security, use Postgres' `pg_hba.conf` to restrict
auth method per source.

## Reverse proxy (nginx)

```nginx
# /etc/nginx/sites-available/platform
upstream api_backend {
    server 127.0.0.1:3001;
    keepalive 32;
}

upstream webapp_backend {
    server 127.0.0.1:9800;
    keepalive 16;
}

server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate     /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

    location / {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 7d;
    }
}

server {
    listen 443 ssl http2;
    server_name app.example.com;

    ssl_certificate     /etc/letsencrypt/live/app.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;

    location / {
        proxy_pass http://webapp_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}

server {
    listen 80;
    server_name api.example.com app.example.com;
    return 301 https://$server_name$request_uri;
}
```

```bash
sudo ln -sf /etc/nginx/sites-available/platform /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## TLS via Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.example.com -d app.example.com
```

Cert auto-renews via certbot's timer.

## Updating

```bash
# Atomic deploy via symlink swap:
ssh omnitron@server <<'EOF'
cd /home/omnitron
NEW=platform-$(date +%s)
mkdir -p $NEW
tar -xzf /home/omnitron/platform.tar.gz -C $NEW
cd $NEW && pnpm install --frozen-lockfile --prod && pnpm omnitron infra migrate
cd /home/omnitron
ln -sfn $NEW platform-next
mv -T platform-next platform
sudo systemctl reload omnitron      # or restart if needed
# Keep previous 5 for rollback:
ls -t platform-* | tail -n +6 | xargs rm -rf
EOF
```

For zero-downtime reload (workers cycle, daemon stays up):

```bash
sudo systemctl reload omnitron      # if unit declares ExecReload
# or directly:
sudo -u omnitron pnpm omnitron reload
```

## Backups

Daily Postgres backup via cron:

```bash
# /etc/cron.d/omnitron-backups
30 2 * * *  postgres  pg_dump platform | gzip > /var/backups/platform-$(date +\%Y\%m\%d).sql.gz
```

Plus Omnitron's built-in:

```bash
omnitron backup schedule create main --cron '0 3 * * *'
```

The Omnitron daemon's state under `~/.omnitron/` is regenerable
— back up if you want history (uptime bars, secrets store).

## Multi-server fleet

Omnitron supports a fleet of daemons addressable by alias:

```bash
# On the master:
omnitron remote add web-1 192.168.1.10 --port 9700
omnitron remote add web-2 192.168.1.11 --port 9700
omnitron remote status web-1
omnitron fleet status
```

Each `omnitron up` daemon listens on TCP 9700 (configurable) for
fleet RPC; the master coordinates.

For cluster mode (leader election), enable in
`/etc/omnitron/env`:

```bash
OMNITRON_CLUSTER_ENABLED=true
OMNITRON_CLUSTER_DISCOVERY=redis
OMNITRON_CLUSTER_PEERS=192.168.1.10:9700,192.168.1.11:9700,192.168.1.12:9700
```

See [Cluster + Fleet](./../omnitron/cluster.md).

## Monitoring

- **Application metrics** — Prometheus scrapes the daemon's
  `:9800/metrics`.
- **Host metrics** — node_exporter on each host.
- **Logs** — Promtail / Filebeat tails journald + Omnitron's
  log directory.
- **Alerts** — Prometheus AlertManager + Omnitron's own
  `OmnitronAlerts`.

## Firewall

```bash
# UFW recipe:
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp                     # SSH
sudo ufw allow 80/tcp                     # HTTP (redirects to HTTPS)
sudo ufw allow 443/tcp                    # HTTPS
sudo ufw allow from 192.168.1.0/24 to any port 9700  # Omnitron TCP — internal only
sudo ufw enable
```

Public exposure of 9700 = full operator surface on the
internet. Never.

## Hardening checklist

- [ ] Run as a non-root user (`omnitron` in examples above).
- [ ] systemd hardening directives (above).
- [ ] `chmod 0600 /etc/omnitron/env`.
- [ ] Firewall closed to 9700 from outside.
- [ ] TLS on nginx (Let's Encrypt or your CA).
- [ ] Postgres `pg_hba.conf` restricts auth.
- [ ] SSH key auth only; password auth disabled.
- [ ] fail2ban on SSH + nginx.
- [ ] Auto-security-updates for the OS (`unattended-upgrades`).
- [ ] Periodic vulnerability scan (`pnpm audit`).

## When bare-metal beats Docker/k8s

- **Predictable latency** — no container abstraction overhead.
- **Direct hardware access** — GPUs, custom NICs, NVMe.
- **Cost** — at scale, raw VPS beats managed.
- **Simplicity** — one server, one systemd unit, one nginx.

When it doesn't:

- **Horizontal scaling** — pets vs cattle; bare-metal is pets.
- **Crash recovery** — no automatic node replacement.
- **Multi-region** — need to roll your own DNS / failover.

## See also

- [Deployment overview](./index.md)
- [Docker Compose](./docker.md) — containerised alternative
- [Cluster + Fleet](./../omnitron/cluster.md) — multi-server patterns
- [Best practices](./../omnitron/best-practices.md)
