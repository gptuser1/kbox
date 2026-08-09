// PluginRegistry — collects backend plugins and mounts their routes
import type { Hono } from 'hono';
import type { BackendPlugin, PluginManifest } from './types';

const plugins: BackendPlugin[] = [];

export function registerPlugin(plugin: BackendPlugin): void {
  if (plugins.find(p => p.manifest.id === plugin.manifest.id)) {
    throw new Error(`Plugin already registered: ${plugin.manifest.id}`);
  }
  plugins.push(plugin);
}

export function getManifests(): PluginManifest[] {
  return plugins.map(p => p.manifest);
}

export function mountPlugins(app: Hono): void {
  for (const plugin of plugins) {
    const { manifest } = plugin;
    if (manifest.entry.backend) {
      app.route(manifest.entry.backend, plugin.router);
      console.log(`[plugin] mounted ${manifest.id} at ${manifest.entry.backend}`);
    }
  }
}

export function getPlugin(id: string): BackendPlugin | undefined {
  return plugins.find(p => p.manifest.id === id);
}
