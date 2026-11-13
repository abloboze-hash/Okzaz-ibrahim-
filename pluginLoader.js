import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { log } from '../utils/logger.js';

export async function loadPlugins(directory) {
  const absoluteDir = path.resolve(directory);
  const entries = await readdir(absoluteDir, { withFileTypes: true });
  const plugins = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
    try {
      const fileUrl = pathToFileURL(path.join(absoluteDir, entry.name)).href;
      const module = await import(fileUrl);
      if (module.default && Array.isArray(module.default.commands) && typeof module.default.execute === 'function') {
        plugins.push(module.default);
        log.info({ plugin: entry.name }, 'Plugin loaded');
      } else {
        log.warn({ plugin: entry.name }, 'Skipped plugin: invalid export');
      }
    } catch (error) {
      log.error({ plugin: entry.name, err: error }, 'Plugin load failed');
    }
  }
  return plugins;
}
