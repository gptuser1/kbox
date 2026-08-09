// Adaptation layer type definitions — shared between frontend and backend
import type { Hono } from 'hono';
import type { ConfigField } from '../services/config';

export interface PluginManifest {
  id: string;             // unique identifier, e.g. 'stock'
  name: string;           // display name
  icon: string;           // emoji icon
  desc: string;           // short description
  version: string;        // semver
  entry: {
    frontend: string;     // frontend module path, e.g. 'stock'
    backend?: string;     // backend route prefix, e.g. '/api/tools/stock'
  };
  config?: ConfigField[]; // config field declarations (optional)
}

export interface CronDefinition {
  pattern: string;        // cron pattern or hour spec
  action: string;         // action identifier
  label: string;          // human-readable label
}

export interface BackendPlugin {
  manifest: PluginManifest;
  router: Hono;                          // Hono sub-router
  cron?: CronDefinition[];               // scheduled tasks (optional)
  init?(env: any): Promise<void>;        // init hook (optional)
}
