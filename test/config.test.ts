import { describe, it, expect } from 'vitest';
import { getConfigSchema } from '../src/config';

describe('getConfigSchema', () => {
  it('returns all config fields', () => {
    const schema = getConfigSchema();
    expect(schema.length).toBeGreaterThan(0);
  });

  it('includes openai_api_key', () => {
    const schema = getConfigSchema();
    const key = schema.find(f => f.key === 'openai_api_key');
    expect(key).toBeDefined();
    expect(key!.sensitive).toBe(true);
  });

  it('includes openai_model with default', () => {
    const schema = getConfigSchema();
    const model = schema.find(f => f.key === 'openai_model');
    expect(model).toBeDefined();
    expect(model!.default).toBeTruthy();
  });

  it('includes tencent_api_base with default', () => {
    const schema = getConfigSchema();
    const tc = schema.find(f => f.key === 'tencent_api_base');
    expect(tc).toBeDefined();
    expect(tc!.default).toBe('https://qt.gtimg.cn');
  });
});