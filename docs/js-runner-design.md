# JS 运行工具（脚本平台）详细设计

> 定位：不是单纯的代码编辑器，而是**运行时扩展平台**。让用户在 Worker 运行时执行自定义 JS，可调用内部能力、可保存、可发布为首页工具、可定时。打通"逻辑层动态化"——新增工具/自动化不再需要部署。

---

## 一、目标与边界

### 1.1 要解决的痛点
当前所有"逻辑"（新工具、新行为、新数据流、cron 内容）都写死在 ts 里，改动必须部署。B 方案让一部分逻辑可在运行时由用户脚本扩展。

### 1.2 一期目标（核心）
- **软定时 cron 基础设施**：wrangler cron 改每小时（避开整点），KV 任务表驱动调度内容动态化
- 脚本 CRUD + 直接运行 + 保存后运行
- 受控的 `kbox` 内部 API（读新闻/基金/云盘、读写受限 KV、fetch 外网、log）
- 发布为首页工具（纯输出，无输入参数）
- 前端编辑器 + 输出区 + 脚本列表
- **JS 脚本定时执行**（依赖软定时基础设施）

### 1.3 二期目标（增强）
- 脚本输入参数（表单）
- 脚本调用脚本
- 伪 REPL 会话模式
- **Cloudflare Queues 集成**（脚本执行异步化，长任务不阻塞 HTTP）

### 1.4 明确不做
- **持久 REPL 会话**：Worker 每次请求是独立 isolate，变量不跨请求保留。一期只做"整段代码运行"，不做"敲一行留一行"。
- **动态 import / require 外部模块**：Workers 运行时不支持。用户只能用纯 JS + 暴露的 API + Workers 全局（fetch/crypto/Headers/Response/btoa/atob/TextEncoder 等）。
- **执行 Python**：Workers 的 Python 是独立 Worker（Pyodide/WASM），不能在同进程内通过接口接收代码执行，且无持久会话。不可行。
- **Queues 用于精确时间表**：Queues 解决"异步卸载"而非"定时调度"，定时调度走软定时 cron 方案。

### 1.5 关于 Cloudflare Queues（推迟到二期）
调研结论：免费额度充足（10K ops/天 ≈ 30 万/月），同 Worker 可同时是 producer + consumer。但 Queues 的核心价值是"把耗时任务从 HTTP 请求卸载到后台"，一期脚本 5s 超时内可同步完成，暂不需要。等出现真正长任务需求（如脚本要抓 50 个 RSS 源）时再引入，届时脚本执行端点自然演进为"提交 job→轮询结果"。

---

## 二、架构总览

```
前端（编辑器/输出/脚本列表/首页卡片）
        │
        ▼  HTTP
后端 Hono 路由 /api/tools/js/*
        │
        ├── 脚本 CRUD ──→ KV namespace: js_scripts
        ├── 执行引擎 ──→ new Function 沙箱 + kbox 对象
        │                  ├── kbox.log     → 收集输出
        │                  ├── kbox.fetch   → 透传 fetch（无鉴权头）
        │                  ├── kbox.kv.*    → 受限 KV 读写
        │                  ├── kbox.news.*  → 直接调用 news 模块读函数
        │                  ├── kbox.stock.* → 直接调用 stock 模块读函数
        │                  ├── kbox.disk.*  → 直接调用 disk 模块读函数
        │                  └── kbox.now/sleep
        └── 定时检查（二期）──→ scheduled handler → 扫描到期脚本 → 执行引擎
```

**关键设计：内部调用不走 HTTP。** `kbox.news.list()` 等直接 import 工具模块的导出函数调用，避免自我 HTTP 请求消耗子请求配额、避免 token 透传。

---

## 三、数据模型

### 3.1 脚本存储
KV namespace：`js_scripts`，key = 脚本 id（短随机串），value：

```typescript
interface JsScript {
  id: string;                    // 短随机 id（如 a3f9k2）
  name: string;                  // 显示名
  desc: string;                  // 描述
  code: string;                  // 用户 JS 代码
  icon: string;                  // emoji 或 SVG（发布为工具时用）
  published: boolean;            // 是否发布到首页
  // 二期：
  params: ScriptParam[];         // 输入参数定义
  schedule: { enabled: boolean; everyMinutes: number; lastRunAt: string | null };
  created_at: string;
  updated_at: string;
  last_run?: { at: string; status: 'ok' | 'error'; duration_ms: number };
}

interface ScriptParam {
  name: string;                  // 参数键（注入到脚本作用域）
  label: string;
  type: 'string' | 'number' | 'boolean';
  default?: any;
}
```

### 3.2 执行结果
```typescript
interface RunResult {
  logs: string[];                // kbox.log 收集的输出
  result?: any;                  // 代码最后表达式的返回值（若为 async 包裹）
  error?: { message: string; stack?: string };
  duration_ms: number;
  truncated?: boolean;           // logs 是否被截断
}
```

---

## 四、后端 API

### 4.1 脚本 CRUD
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/tools/js/scripts` | 列出所有脚本 |
| POST | `/api/tools/js/scripts` | 新建（自动生成 id） |
| GET | `/api/tools/js/scripts/:id` | 详情 |
| PUT | `/api/tools/js/scripts/:id` | 更新（code/name/desc/icon/published/params/schedule） |
| DELETE | `/api/tools/js/scripts/:id` | 删除 |
| GET | `/api/tools/js/published` | 列出 published=true 的脚本（供首页渲染卡片） |
| POST | `/api/tools/js/scripts/:id/publish` | body `{published:bool}` 切换发布 |

### 4.2 执行
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/tools/js/run` | 临时执行（不保存），body `{code, params?}` |
| POST | `/api/tools/js/scripts/:id/run` | 运行已保存脚本，body `{params?}` |

返回 `RunResult`。

### 4.3 定时触发（二期）
- `POST /api/tools/js/trigger-scheduled`：手动触发一次"检查到期脚本并执行"（调试用）。
- scheduled handler 自动调用（见第七章）。

---

## 五、执行沙箱

### 5.1 执行方式
用 `new Function` 构造异步函数，解构注入 kbox：

```typescript
async function executeScript(code: string, kbox: KboxApi, params: Record<string, any>, timeoutMs = 5000): Promise<RunResult> {
  const logs: string[] = [];
  const started = Date.now();
  // 把 params 注入作用域顶部
  const paramNames = Object.keys(params);
  const paramValues = Object.values(params);
  const wrapped = `
    const { log, fetch, kv, news, stock, disk, now, sleep } = kbox;
    const { ${paramNames.join(', ')} } = params;
    return (async () => {
      ${code}
    })();
  `;
  try {
    const fn = new Function('kbox', 'params', wrapped);
    const resultPromise = fn(kbox, params);
    const result = await Promise.race([
      resultPromise,
      timeout(timeoutMs),  // 超时拒绝
    ]);
    return { logs, result, duration_ms: Date.now() - started, truncated: logs.join('').length > 100000 };
  } catch (e) {
    return {
      logs,
      error: { message: e instanceof Error ? e.message : String(e), stack: e instanceof Error ? e.stack : undefined },
      duration_ms: Date.now() - started,
      truncated: logs.join('').length > 100000,
    };
  }
}
```

### 5.2 隔离边界
- `new Function` 在全局作用域创建函数，**用户代码无法访问闭包变量**，只能访问解构出的 kbox 成员 + 全局对象。
- 不注入 `env`、不注入 Hono 的 `c`、不注入任何含 token 的对象。
- 用户代码可访问的 Workers 全局：`fetch`（已被 kbox.fetch 包装，不带鉴权）、`crypto`、`Headers`、`Request`、`Response`、`btoa`、`atob`、`TextEncoder`、`TextDecoder`、`URL`、`Date`、`Math`、`JSON`、`console`（重定向到 logs）等。
- `console.log/error/warn` 全部重定向到 logs 数组。

### 5.3 超时
- wall-clock 超时 5 秒（`Promise.race` + `setTimeout`）。Workers 支持 `setTimeout`。
- 超时后返回 `{ error: { message: '执行超时（5s）' } }`。
- 注：Workers CPU 时间限制（付费 30s）是另一层兜底，正常脚本不会触及。

### 5.4 输出截断
- logs 拼接后超过 100KB 截断，设 `truncated: true`。

---

## 六、kbox 对象（安全边界，核心）

### 6.1 设计原则
1. **绝不暴露任何 token / env**：kbox 对象不携带 `D1_API_TOKEN`、`ACCESS_TOKEN`、加密主密钥。
2. **读多写少**：读接口放开（读公共数据），写接口限定 namespace。
3. **内部直调**：`kbox.news.list()` 直接 import news 模块的查询函数，不走 HTTP。

### 6.2 暴露的 API

```typescript
interface KboxApi {
  log(...args: any[]): void;                              // 收集输出
  now(): string;                                          // 北京时间 ISO
  sleep(ms: number): Promise<void>;                       // 注意 CPU 时间限制

  fetch(url: string, opts?: RequestInit): Promise<Response>;  // 透传，不带鉴权头

  kv: {
    get<T>(ns: string, key: string): Promise<T | null>;
    set(ns: string, key: string, value: any): Promise<void>;
    delete(ns: string, key: string): Promise<void>;
    list<T>(ns: string): Promise<Array<{ key: string; value: T }>>;
  };

  news: {
    list(limit?: number): Promise<any[]>;                 // 最近新闻
    top(): Promise<any>;                                  // Top10 关键词快照
  };

  stock: {
    funds(): Promise<any[]>;                              // 基金列表
  };

  disk: {
    files(): Promise<any[]>;                              // 文件列表
    stats(): Promise<any>;                                // 容量统计
  };
}
```

### 6.3 KV 写入的 namespace 黑名单
脚本写 KV 时禁止写入以下系统 namespace，避免破坏系统/窃取配置：

```
禁止写：app, tool:*, preferences, dispatch_configs, db_admin_connections,
        js_scripts, disk_tokens, news_top_keywords, stock_funds
```

- `kv.set` 调用前校验 ns 不在黑名单（前缀匹配 `tool:*`）。
- 违规抛 `Error('禁止写入系统 namespace: ' + ns)`。
- 允许写：用户自定义 namespace（如 `mydata`、`reports`）。
- 读不限制（脚本可读 Top10、基金等公共数据）。

### 6.4 内部直调实现
需把现有工具的读逻辑抽成可复用函数并 export：
- `news.ts` 导出 `listNews(db, limit)`、`getTopKeywords(kv)`
- `stock.ts` 导出 `listFunds(kv)`
- `cloud-disk.ts` 导出 `listFiles(db)`、`getStats(db)`

一期可先用现有内部函数，必要时小幅重构。

---

## 七、软定时 cron 基础设施（一期）

### 7.1 动机
当前 cron 硬编码在 wrangler.toml（`0 0,4,10,14 * * *`，每天 4 次新闻抓取），内容写死、频率写死。改为通用软定时后：
- 定时内容动态化（新闻抓取、JS 脚本都可作为可配置任务）
- 频率可前端配置（不再部署改 cron 表达式）
- 为 JS 脚本定时执行提供基础

### 7.2 方案
- **wrangler.toml cron 改为** `5 * * * *`（每小时第 5 分钟，避开整点流量高峰）。
- KV namespace `cron_tasks` 存任务表：
  ```typescript
  interface CronTask {
    id: string;                    // 短随机 id
    name: string;                  // 显示名
    type: 'news' | 'script';       // 任务类型
    everyMinutes: number;          // 执行间隔（最小 5）
    enabled: boolean;
    scriptId?: string;             // type='script' 时关联的脚本 id
    lastRunAt: string | null;      // 上次执行时间（ISO）
    lastStatus?: 'ok' | 'error';   // 上次执行结果
    lastError?: string;            // 上次错误信息
    createdAt: string;
  }
  ```
- scheduled handler 改为 `runCronTasks(env)`：
  - 拉所有 `enabled=true` 的任务
  - 对每个：若 `lastRunAt == null || now - lastRunAt >= everyMinutes`，执行
  - 执行后更新 `lastRunAt`、`lastStatus`、`lastError`
- 任务执行逻辑按 type 分发：
  - `type='news'` → 调用 `runNewsCron({env})`（复用已有）
  - `type='script'` → 调用 `executeScript(env, scriptId, {})`（JS Runner）

### 7.3 迁移策略
- 部署后自动检查 `cron_tasks` 是否为空，为空则插入一个默认 news 任务（everyMinutes=360，即 6 小时，对应原 4 次/天）
- 现有 wrangler cron 的 4 次新闻抓取被新机制取代（频率可前端调整）
- 不影响现有新闻数据

### 7.4 限制
- 最细粒度 = 1 小时（受 cron `5 * * * *` 限制）
- `everyMinutes` 最小值 5（防抖，即便每小时触发也最多每 5 分钟跑一次同任务）
- 定时执行结果存 `lastStatus`/`lastError`，前端可看最近一次执行状态
- 脚本定时执行不传 params（用 default，一期无 params）

### 7.5 成本
- 每小时 1 次 KV list + 少量任务执行。单用户场景远低于免费额度。

### 7.6 前端管理 UI
- 在配置管理或独立"Cron 任务"页：
  - 列出所有任务（名称/类型/频率/启用/上次执行）
  - 新增/编辑/删除任务
  - 手动触发某任务（调试用）
  - news 任务和 script 任务统一管理

---

## 八、发布为首页工具

### 8.1 机制
- 脚本 `published=true` 时，前端首页工具卡片追加一个卡片。
- 卡片 id = `script:<scriptId>`，与原生工具并列。
- 点击进入"运行视图"：参数表单（二期）+ 运行按钮 + 输出区。

### 8.2 与现有偏好系统集成
- 已发布脚本卡片复用 `preferences/home_layout` 的 `order` 和 `overrides`（改名/改图标/隐藏）。
- 前端 `orderedTools()` 合并：静态 TOOLS + `/api/tools/js/published` 返回的脚本。
- 脚本删除或取消发布时，前端从卡片区移除（home_layout 里的悬空 id 自动忽略，不报错）。

### 8.3 运行视图 UI
```
┌─ 脚本名 ──────────────────────────┐
│ 描述                              │
│ [参数表单（二期）]                │
│ [▶ 运行]   [✎ 编辑脚本]          │
│ ─────────────────────────────    │
│ 输出：                            │
│ > log line 1                     │
│ > log line 2                     │
│ 结果: {...}                       │
│ 耗时: 234ms                       │
└──────────────────────────────────┘
```

---

## 九、前端 UI

### 9.1 JS Runner 工具主页（编辑/管理）
```
┌─ JS 运行工具 ────────────────────────────┐
│ [+ 新建脚本]                             │
│ ── 脚本列表 ──                           │
│ ▸ 早报生成    [已发布] [定时] [运行][编辑][删除] │
│ ▸ 质数计算    [运行][编辑][删除]         │
│                                          │
│ ── 临时运行 ──                           │
│ ┌────────────────────────────────────┐  │
│ │ // 输入代码                         │  │
│ │ const top = await kbox.news.top(); │  │
│ │ kbox.log(JSON.stringify(top));     │  │
│ └────────────────────────────────────┘  │
│ [▶ 运行]  [存为脚本]                     │
│ ── 输出 ──                               │
│ > ...                                    │
└──────────────────────────────────────────┘
```

### 9.2 脚本编辑弹层
- 名称 / 描述 / 图标（emoji 选择器，复用首页那套）
- 代码编辑区（textarea，一期不做语法高亮，保持轻量）
- 勾选：发布到首页
- 定时配置：勾选"定时执行" → 填 everyMinutes（最小 5）→ 保存后自动在 cron_tasks 创建一条 type='script' 任务；取消勾选则删除对应 cron_task
- 二期：参数定义

### 9.3 编辑器选型
- 一期：纯 textarea + 等宽字体 + 行号（CSS 实现）。
- 不引入 CodeMirror/Monaco（体积大，与单文件前端风格冲突）。
- 若后续体验不足，再考虑轻量高亮（如 prism.js 单文件）。

### 9.4 首页卡片集成
- `loadHomeLayout()` 时并行加载 `/api/tools/js/published`。
- 把已发布脚本转成虚拟工具对象 `{ id: 'script:xxx', name, icon, desc, render, mount }`。
- `render`/`mount` 用通用的脚本运行视图渲染器（参数化注入 scriptId）。

---

## 十、限制与风险

| 风险 | 缓解 |
|---|---|
| 密钥泄漏 | kbox 对象不携带任何 token；env 不注入；KV 写黑名单保护配置 namespace |
| 脚本死循环 | 5s wall-clock 超时 + Workers CPU 时间兜底 |
| fetch 滥用 | 单请求子请求上限 50 个（Workers 运行时限制）；无鉴权信息；单用户场景可接受 |
| KV 写污染 | namespace 黑名单；脚本只能写自定义 namespace |
| 脚本互相干扰 | 各脚本写自己的 namespace（约定 `script:<id>`）；读可共享 |
| 输出过大 | logs 100KB 截断 |
| 定时冷启动 | 一期已做软定时；最细粒度 1 小时（受 cron 限制） |

---

## 十一、与现有系统集成点

1. **preferences API**：已发布脚本作为虚拟工具，复用 home_layout 的 order/overrides。
2. **kbox 对象**：直接 import news/stock/disk 模块的读函数（需小幅重构导出）。
3. **KV 表**：脚本存 `js_scripts` namespace；脚本写数据用自定义 namespace（黑名单外的）。
4. **前端 TOOLS 注册**：动态追加，不修改静态 TOOLS 数组。
5. **cron**（一期）：wrangler.toml 改 `5 * * * *`，scheduled handler 改为 `runCronTasks`（软定时，按 KV 任务表分发）。

---

## 十二、实施分期

### 一期（核心）
**A. 软定时 cron 基础设施（先做，JS 定时依赖它）**
- [ ] wrangler.toml cron 改为 `5 * * * *`
- [ ] 后端：KV `cron_tasks` 任务表 + CRUD API（list/create/update/delete/trigger）
- [ ] 后端：`runCronTasks(env)` 调度器（按 type 分发，news→runNewsCron，script→executeScript）
- [ ] 后端：迁移默认 news 任务（首次为空时自动插入）
- [ ] 前端：Cron 任务管理页（列表/新增/编辑/删除/手动触发）

**B. JS Runner 核心**
- [ ] 后端：news/stock/disk 读函数 export（小幅重构）
- [ ] 后端：脚本 CRUD（5 端点）+ 执行端点（2 个）+ published 列表
- [ ] 后端：执行沙箱 + kbox 对象（log/fetch/kv/news/stock/disk/now/sleep）
- [ ] 后端：KV 写 namespace 黑名单
- [ ] 前端：JS Runner 工具页（脚本列表 + 临时运行 + 编辑弹层含定时配置）
- [ ] 前端：脚本运行视图（输出区）
- [ ] 前端：首页已发布脚本卡片集成（复用 home_layout）

**C. 收尾**
- [ ] 类型检查 + 构建 + 提交

### 二期（增强）
- [ ] 脚本输入参数（表单生成 + 注入作用域）
- [ ] 脚本调用脚本（`kbox.script.run(id, params)`）
- [ ] 伪 REPL（前端拼接历史重跑，分块显示输出）
- [ ] Cloudflare Queues 集成（脚本执行异步化，长任务不阻塞 HTTP，提交 job→轮询结果）

---

## 十三、示例脚本

### 示例 1：取 Top10 并格式化输出
```javascript
const top = await kbox.news.top();
kbox.log('📊 今日热点 Top 10');
kbox.log('生成于：' + kbox.now());
for (const kw of top.keywords || []) {
  kbox.log(kw.keyword + ' (热度 ' + kw.heat_score + ')');
}
```

### 示例 2：抓外部 API 存 KV
```javascript
const res = await kbox.fetch('https://api.github.com/repos/gptuser1/kbox');
const data = await res.json();
kbox.log('Stars: ' + data.stargazers_count);
await kbox.kv.set('mydata', 'github_stats', { stars: data.stargazers_count, at: kbox.now() });
kbox.log('已保存到 KV');
```

### 示例 3：基金列表汇总（发布为工具）
```javascript
const funds = await kbox.stock.funds();
let total = 0;
for (const f of funds) {
  total += f.estimated_value || 0;
  kbox.log(f.name + ': ' + f.estimated_value);
}
kbox.log('———');
kbox.log('总估值：' + total.toFixed(2));
return { count: funds.length, total };
```
