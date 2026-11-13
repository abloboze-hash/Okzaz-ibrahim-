import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(path.resolve(filePath), 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return fallback;
  }
}

export async function writeJson(filePath, data) {
  const absolute = path.resolve(filePath);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
}
