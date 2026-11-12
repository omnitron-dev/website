// Development only. Static production output is published by the Pages workflow.
const port = 4178;

export default {
  project: 'omnitron-docs',
  stacks: {
    dev: {
      type: 'local',
      watch: true,
      apps: ['site'],
      infrastructureOwnership: 'external',
    },
  },
  apps: [{
    name: 'site',
    script: 'scripts/dev.js',
    // Lumen watches its content/client sources; Omnitron owns process restarts.
    watch: 'scripts',
    env: { LUMEN_DEV_PORT: String(port) },
    readiness: {
      intervalMs: 1000,
      timeoutMs: 3000,
      probes: [{
        name: 'website',
        type: 'http',
        url: `http://127.0.0.1:${port}/`,
        expectedStatus: 200,
      }],
    },
  }],
};
