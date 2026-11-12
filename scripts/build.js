// Xec owns process execution and reports failures; Lumen owns compilation.
await $`lumen build`.timeout('10m').stdout('inherit').stderr('inherit');
await $`node scripts/check-routes.js`.timeout('2m').stdout('inherit').stderr('inherit');
