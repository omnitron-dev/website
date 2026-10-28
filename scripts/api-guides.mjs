// Every current public entry point has an explicit guide. New exports require a deliberate mapping.
export default {
  "@omnitron-dev/access": {
    ".": "auth/access-policy.md",
    "./roles": "auth/access-policy.md",
    "./permissions": "auth/access-policy.md",
    "./platform": "auth/access-policy.md"
  },
  "@omnitron-dev/titan-storage": { ".": "titan/modules/storage.md" },
  "@omnitron-dev/common": {
    ".": "utilities/common.md"
  },
  "@omnitron-dev/cuid": {
    ".": "utilities/cuid.md"
  },
  "@omnitron-dev/eventemitter": {
    ".": "utilities/eventemitter.md"
  },
  "@omnitron-dev/kb": {
    ".": "utilities/kb.md",
    "./titan": "utilities/kb.md",
    "./extractors": "utilities/kb.md",
    "./embeddings": "utilities/kb.md",
    "./specs": "utilities/kb.md",
    "./discovery": "utilities/kb.md",
    "./surreal": "utilities/kb.md"
  },
  "@omnitron-dev/msgpack": {
    ".": "utilities/msgpack.md",
    "./smart-buffer": "utilities/msgpack.md"
  },
  "@omnitron-dev/netron-browser": {
    ".": "frontend/netron/browser.md",
    "./client": "frontend/netron/browser.md",
    "./client/http": "frontend/netron/transports.md",
    "./client/websocket": "frontend/netron/transports.md",
    "./types": "frontend/netron/browser.md",
    "./errors": "frontend/netron/errors.md",
    "./utils": "frontend/netron/browser.md",
    "./packet": "reference/protocol.md",
    "./middleware": "frontend/netron/middleware.md"
  },
  "@omnitron-dev/netron-http-core": {
    ".": "reference/protocol.md"
  },
  "@omnitron-dev/netron-protocol": {
    ".": "reference/protocol.md"
  },
  "@omnitron-dev/netron-react": {
    ".": "frontend/netron/react.md",
    "./hooks": "frontend/netron/react.md",
    "./auth": "frontend/netron/auth.md",
    "./cache": "frontend/netron/caching.md",
    "./devtools": "frontend/netron/testing.md",
    "./test": "frontend/netron/testing.md"
  },
  "@omnitron-dev/prism": {
    "./components/admin-filters": "frontend/prism/components.md",
    "./components/alert": "frontend/prism/components.md",
    "./components/animate": "frontend/prism/components.md",
    "./components/breadcrumbs": "frontend/prism/components.md",
    "./components/card": "frontend/prism/components.md",
    "./components/command-palette": "frontend/prism/components.md",
    "./components/confirm-dialog": "frontend/prism/components.md",
    "./components/empty-content": "frontend/prism/components.md",
    "./components/error-boundary": "frontend/prism/components.md",
    "./components/label": "frontend/prism/components.md",
    "./components/loading-screen": "frontend/prism/components.md",
    "./components/navigation-progress": "frontend/prism/components.md",
    "./components/page-content": "frontend/prism/components.md",
    "./components/popover": "frontend/prism/components.md",
    "./components/scroll-to-top": "frontend/prism/components.md",
    "./components/skeleton": "frontend/prism/components.md",
    "./components/snackbar": "frontend/prism/components.md",
    "./components/stepper": "frontend/prism/components.md",
    "./components/table": "frontend/prism/components.md",
    "./components/tabs": "frontend/prism/components.md",

    "./auth": "frontend/prism/blocks.md",
    ".": "frontend/prism/index.md",
    "./ui": "frontend/prism/theme.md",
    "./icons": "frontend/prism/theme.md",
    "./components/doc-layout": "frontend/prism/components.md",
    "./theme": "frontend/prism/theme.md",
    "./core": "frontend/prism/theme.md",
    "./layouts": "frontend/prism/layouts.md",
    "./blocks": "frontend/prism/blocks.md",
    "./components": "frontend/prism/components.md",
    "./components/map": "frontend/prism/maps.md",
    "./components/map/styles.css": {guide: "frontend/prism/maps.md", assetSource: "src/components/map/map.css"},
    "./components/editor": "frontend/prism/components.md",
    "./components/emoji-picker": "frontend/prism/components.md",
    "./components/research-editor": "frontend/prism/components.md",
    "./components/research-editor/styles.css": {guide: "frontend/prism/components.md", assetSource: "src/components/research-editor/editor.css"},
    "./components/knowledge-graph": "frontend/prism/components.md",
    "./components/knowledge-graph/styles.css": {guide: "frontend/prism/components.md", assetSource: "src/components/knowledge-graph/graph.css"},
    "./components/research": "frontend/prism/components.md",
    "./components/research/styles.css": {
      guide: "frontend/prism/components.md",
      assetSource: "src/components/research/research.css"
    },
    "./state": "frontend/prism/state.md",
    "./hooks": "frontend/prism/hooks-catalog.md",
    "./forms": "frontend/prism/forms.md",
    "./accessibility": "frontend/prism/accessibility.md",
    "./netron": "frontend/netron/react.md",
    "./http": "frontend/prism/http.md",
    "./cli": "frontend/prism/cli.md"
  },
  "@omnitron-dev/testing": {
    ".": "testing/testing-package.md",
    "./async": "testing/testing-package.md",
    "./docker": "testing/testing-package.md",
    "./runtime/vitest": "testing/testing-package.md",
    "./runtime/bun": "testing/testing-package.md",
    "./runtime/deno": "testing/testing-package.md",
    "./runtime/node": "testing/testing-package.md",
    "./titan": "testing/testing-package.md",
    "./helpers": "testing/testing-package.md",
    "./performance": "testing/testing-package.md",
    "./env": "testing/testing-package.md"
  },
  "@omnitron-dev/titan": {
    ".": "titan/overview.md",
    "./application": "titan/application/index.md",
    "./lifecycle": "titan/application/lifecycle.md",
    "./decorators": "titan/decorators/index.md",
    "./netron": "titan/netron.md",
    "./netron/service-descriptor": "titan/netron/services.md",
    "./netron/transport/http": "titan/netron/transports.md",
    "./netron/transport/websocket": "titan/netron/transports.md",
    "./netron/transport/tcp": "titan/netron/transports.md",
    "./netron/transport/unix": "titan/netron/transports.md",
    "./netron/transport/http/middleware": "titan/netron/middleware.md",
    "./netron/auth": "titan/netron/authentication.md",
    "./netron/multi-backend": "titan/netron/multi-backend.md",
    "./nexus": "titan/di/overview.md",
    "./validation": "titan/validation/overview.md",
    "./module/config": "titan/modules/config.mdx",
    "./module/logger": "titan/modules/logger.mdx",
    "./module/rls": "titan/modules/rls.md",
    "./errors": "titan/errors/overview.md",
    "./types": "titan/modules-system/defining-modules.md",
    "./utils": "titan/resilience/overview.md",
    "./tracing": "titan/tracing.md"
  },
  "@omnitron-dev/titan-auth": {
    ".": "titan/modules/auth.mdx",
    "./preset/shared-session": "titan/modules/shared-session.md",
    "./access": "auth/access-policy.md"
  },
  "@omnitron-dev/titan-cache": {
    ".": "titan/modules/cache.mdx"
  },
  "@omnitron-dev/titan-database": {
    ".": "titan/modules/database.mdx",
    "./plugins": "titan/modules/database.mdx",
    "./transaction": "titan/modules/database.mdx",
    "./repository": "titan/modules/database.mdx",
    "./migration": "titan/modules/database.mdx",
    "./kysera": "titan/modules/database.mdx",
    "./rls": "titan/modules/database.mdx",
    "./dialects": "titan/modules/database.mdx"
  },
  "@omnitron-dev/titan-discovery": {
    ".": "titan/modules/discovery.mdx"
  },
  "@omnitron-dev/titan-events": {
    ".": "titan/modules/events.mdx"
  },
  "@omnitron-dev/titan-health": {
    ".": "titan/modules/health.mdx"
  },
  "@omnitron-dev/titan-lock": {
    ".": "titan/modules/lock.mdx"
  },
  "@omnitron-dev/titan-mailer": {
    ".": "titan/modules/mailer.mdx",
    "./notifications": "titan/modules/mailer.mdx",
    "./postgres": "titan/modules/mailer.mdx"
  },
  "@omnitron-dev/titan-metrics": {
    ".": "titan/modules/metrics.mdx"
  },
  "@omnitron-dev/titan-notifications": {
    ".": "titan/modules/notifications.mdx",
    "./rotif": "titan/modules/notifications.mdx"
  },
  "@omnitron-dev/titan-pm": {
    ".": "titan/modules/pm.mdx"
  },
  "@omnitron-dev/titan-ratelimit": {
    ".": "titan/modules/ratelimit.mdx"
  },
  "@omnitron-dev/titan-redis": {
    ".": "titan/modules/redis.mdx"
  },
  "@omnitron-dev/titan-scheduler": {
    ".": "titan/modules/scheduler.mdx",
    "./persistence": "titan/modules/scheduler.mdx"
  },
  "@omnitron-dev/titan-telemetry-relay": {
    ".": "titan/modules/telemetry-relay.mdx"
  },
  "@omnitron-dev/omnitron": {
    ".": "omnitron/services-reference.md",
    "./config": "omnitron/configuration.md",
    "./operations": "omnitron/releases.md",
    "./dto/services": "omnitron/services-reference.md",
    "./dto/events": "omnitron/services-reference.md",
    "./alerts": "omnitron/observability.md",
    "./release-reading": "omnitron/releases.md",
    "./node-check": "omnitron/cli.md",
    "./audit-outcome": "omnitron/observability.md",
    "./sync-reading": "omnitron/cluster.md"
  }
};
