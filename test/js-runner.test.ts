import { describe, it, expect } from 'vitest';
import { isWriteForbidden } from '../src/plugins/js-runner/backend';

describe('isWriteForbidden', () => {
  it('blocks system namespaces', () => {
    expect(isWriteForbidden('app')).toBe(true);
    expect(isWriteForbidden('preferences')).toBe(true);
    expect(isWriteForbidden('dispatch_configs')).toBe(true);
    expect(isWriteForbidden('db_admin_connections')).toBe(true);
    expect(isWriteForbidden('js_scripts')).toBe(true);
    expect(isWriteForbidden('disk_tokens')).toBe(true);
    expect(isWriteForbidden('news_top_keywords')).toBe(true);
    expect(isWriteForbidden('stock_funds')).toBe(true);
    expect(isWriteForbidden('cron_tasks')).toBe(true);
  });

  it('blocks plugin: prefixed namespaces', () => {
    expect(isWriteForbidden('plugin:news')).toBe(true);
    expect(isWriteForbidden('plugin:disk')).toBe(true);
    expect(isWriteForbidden('plugin:stock')).toBe(true);
  });

  it('allows user namespaces', () => {
    expect(isWriteForbidden('my_data')).toBe(false);
    expect(isWriteForbidden('user_scripts')).toBe(false);
    expect(isWriteForbidden('custom')).toBe(false);
  });
});