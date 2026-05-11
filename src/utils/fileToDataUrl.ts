import { invoke } from '@tauri-apps/api/core';

const cache = new Map<string, string>();

function getMimeType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
  };
  return map[ext] ?? 'image/jpeg';
}

export async function filePathToDataUrl(path: string): Promise<string> {
  if (cache.has(path)) return cache.get(path)!;
  const base64 = await invoke<string>('read_file_as_base64', { path });
  const dataUrl = `data:${getMimeType(path)};base64,${base64}`;
  cache.set(path, dataUrl);
  return dataUrl;
}

export function clearFileCache(path?: string) {
  if (path) cache.delete(path);
  else cache.clear();
}
