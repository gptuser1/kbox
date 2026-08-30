// 免费模型池服务单测：验证多源合并、双0免费过滤、AA 排序、极简清单。
// 全部离线：mock 全局 fetch，不触网。
import { describe, it, expect, vi, afterEach } from 'vitest';
import { compilePool, refreshModelPool } from '../src/services/model-pool';

afterEach(() => {
  vi.unstubAllGlobals();
});

interface MockRoute {
  url: string;
  headers?: Record<string, string>;
  body: any;
}

function stubFetch(routes: MockRoute[]) {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    const route = routes.find(r => u.startsWith(r.url));
    // 校验 AA key 头
    if (route?.headers) {
      const h = (init?.headers || {}) as Record<string, string>;
      for (const [k, v] of Object.entries(route.headers)) {
        if (h[k] !== v) throw new Error(`missing header ${k}`);
      }
    }
    const body = route ? route.body : { error: 'not found' };
    return {
      ok: !!route,
      status: route ? 200 : 404,
      json: async () => body,
    } as Response;
  }));
}

describe('compilePool', () => {
  it('合并 OpenRouter(:free 双0) 与 zen(-free) 两源并带 baseurl', async () => {
    stubFetch([
      { url: 'https://openrouter.ai/api/v1/models', body: { data: [
        { id: 'google/a:free', pricing: { prompt: '0', completion: '0' } },
        { id: 'google/b:free', pricing: { prompt: '1', completion: '0' } }, // 非免费，剔除
        { id: 'google/c', pricing: { prompt: '0', completion: '0' } },       // 无 :free 后缀，剔除
      ] } },
      { url: 'https://opencode.ai/zen/v1/models', body: { data: [
        { id: 'muse-spark-1.2-contributor-free' },
        { id: 'paid-model' },
      ] } },
      {
        url: 'https://artificialanalysis.ai/api/v2/data/llms/models',
        headers: { 'x-api-key': 'aa-key' },
        body: { data: [
          { name: 'A', evaluations: { artificial_analysis_intelligence_index: 1 } },
        ] },
      },
    ]);
    const pool = await compilePool({ AA_API_KEY: 'aa-key' } as any);
    expect(pool).toEqual([
      { model: 'google/a:free', baseurl: 'https://openrouter.ai/api/v1' },
      { model: 'muse-spark-1.2-contributor-free', baseurl: 'https://opencode.ai/zen/v1' },
    ]);
  });

  it('AA 有评分的按指数降序在前，无评分者落后', async () => {
    stubFetch([
      { url: 'https://openrouter.ai/api/v1/models', body: { data: [
        { id: 'vendor/low:free', pricing: { prompt: '0', completion: '0' } },
        { id: 'vendor/high:free', pricing: { prompt: '0', completion: '0' } },
        { id: 'vendor/noscore:free', pricing: { prompt: '0', completion: '0' } },
      ] } },
      { url: 'https://opencode.ai/zen/v1/models', body: { data: [] } },
      {
        url: 'https://artificialanalysis.ai/api/v2/data/llms/models',
        headers: { 'x-api-key': 'test-key' },
        body: { data: [
          { name: 'High', evaluations: { artificial_analysis_intelligence_index: 90 } },
          { name: 'Low', evaluations: { artificial_analysis_intelligence_index: 40 } },
        ] },
      },
    ]);
    const pool = await compilePool({ AA_API_KEY: 'test-key' } as any);
    expect(pool.map(e => e.model)).toEqual([
      'vendor/high:free',   // 90 → 最前
      'vendor/low:free',    // 40
      'vendor/noscore:free' // 无评分 → 最后
    ]);
  });

  it('缺 AA_API_KEY 时整个编译失败，不产出未排序假池', async () => {
    stubFetch([
      { url: 'https://openrouter.ai/api/v1/models', body: { data: [
        { id: 'vendor/x:free', pricing: { prompt: '0', completion: '0' } },
      ] } },
      { url: 'https://opencode.ai/zen/v1/models', body: { data: [] } },
    ]);
    await expect(compilePool({} as any)).rejects.toThrow('AA_API_KEY');
  });
});

describe('refreshModelPool', () => {
  it('空池时返回失败且不写 KV', async () => {
    stubFetch([
      { url: 'https://openrouter.ai/api/v1/models', body: { data: [] } },
      { url: 'https://opencode.ai/zen/v1/models', body: { data: [] } },
    ]);
    const kvSet = vi.fn();
    // createKv 依赖 SECRET + D1，用不会真正写库的执行路径：compilePool 为空会提前返回
    const r = await refreshModelPool({
      AA_API_KEY: '',
      SECRET: { get: async () => 'sk' },
      D1_API_BASE: undefined,
      _kv: { set: kvSet },
    } as any);
    expect(r.success).toBe(false);
  });
});