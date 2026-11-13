import { loadPlugins } from './handlers/pluginLoader.js';
import { startSession } from './handlers/multiSession.js';
import { readJson } from './utils/jsonStore.js';
import { log } from './utils/logger.js';

async function main() {
  const config = await readJson('./config.json', {});
  const plugins = await loadPlugins('./plugins');

  if (!Array.isArray(config.sessions) || config.sessions.length === 0) {
    throw new Error('config.json must contain at least one session name in "sessions".');
  }

  log.info(`Loaded ${plugins.length} plugin(s).`);
  await Promise.all(
    config.sessions.map((name) =>
      startSession(String(name), { config, plugins }).catch((error) => {
        log.error({ session: name, err: error }, 'Session failed to start');
      })
    )
  );
}

main().catch((error) => {
  log.error({ err: error }, 'Fatal startup error');
  process.exitCode = 1;
});

process.on('unhandledRejection', (reason) => log.error({ err: reason }, 'Unhandled rejection'));
process.on('uncaughtException', (error) => {
  log.fatal({ err: error }, 'Uncaught exception');
  process.exit(1);
});
