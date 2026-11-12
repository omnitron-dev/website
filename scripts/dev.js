import { runLumenCli } from '@omnitron-dev/lumen/cli';

const port = process.env.LUMEN_DEV_PORT;
if (!port || !/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
  throw new Error('LUMEN_DEV_PORT must be an integer from 1 to 65535 in the managed site configuration.');
}

await runLumenCli(['dev', '--root', process.cwd(), '--host', '127.0.0.1', '--port', port]);
process.send?.({ type: 'ready' });
