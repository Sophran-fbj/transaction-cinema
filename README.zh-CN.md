# Transaction Cinema

[English](./README.md) | 简体中文

[![CI](https://github.com/Sophran-fbj/transaction-cinema/actions/workflows/ci.yml/badge.svg)](https://github.com/Sophran-fbj/transaction-cinema/actions/workflows/ci.yml)

> 把一笔链上交易，拍成一部看得懂的短片。

输入一笔以太坊主网交易的 Hash，Transaction Cinema 会直接读取交易、回执、区块和事件日志，把它们编排成一段短动画：资金如何流动、代币怎样穿过流动性池、交易为什么回滚，以及 Gas 最终花在了哪里。

不需要连接钱包，也不依赖 Etherscan、The Graph 或其他索引服务。屏幕上的金额、地址、Gas、区块和时间，都可以追溯到原始 JSON-RPC 响应。

## 这个项目解决什么问题

一笔交易在区块浏览器里通常是一页字段、日志和十六进制数据。它准确，但不容易快速读懂。

Transaction Cinema 不试图替代区块浏览器，而是把一笔已确认交易最重要的过程组织成一个可暂停、继续和重播的“交易短片”。视觉效果是叙事手段，数据才是事实来源。

| 你会看到什么 | 数据来自哪里 |
| --- | --- |
| ETH 或 ERC-20 在地址之间的流动 | 交易 value 与 `Transfer` 日志 |
| 授权额度、无限授权与撤销授权 | `Approval` 日志和调用数据 |
| Uniswap V2 的输入、输出与储备变化 | `Swap`、`Sync` 日志 |
| Uniswap V3 的输入、输出、终点 tick 与流动性 | `Swap` 日志与池合约读取 |
| 回滚交易的“尝试 → 拒绝 → 倒带” | 调用数据、回执状态与 Gas 数据 |

## 已支持的交易类型

| 类型 | 呈现方式 | 状态 |
| --- | --- | --- |
| ETH 原生转账 | 钱包之间的价值流动 | ✅ 已支持 |
| ERC-20 转账 | 代币流动与精确金额 | ✅ 已支持 |
| ERC-20 授权 | 限额、无限授权、撤销授权 | ✅ 已支持 |
| Uniswap V2 单交易对交换 | 输入/输出粒子、储备罐与 `x × y = k` | ✅ 已支持 |
| Uniswap V3 单池交换 | 流动性通道、价格指针与终点 tick | ✅ 已支持 |
| ETH 经 WETH 包装后的 V3 交换 | 识别包装、交换与退款路径 | ✅ 已支持 |
| 可解码调用数据的回滚交易 | 尝试、拒绝、倒带与 Gas | ✅ 已支持 |
| 多跳交换、聚合器 | — | 🚧 计划中 |
| ERC-721 / ERC-1155 转账 | — | 🚧 计划中 |
| 合约创建与任意合约调用 | 通用回执叙事 | 🚧 计划中 |
| Base、Arbitrum、Optimism 等其他网络 | — | 🚧 计划中 |

无法可靠分类时，应用会明确展示“未知交易”与原始 4 字节 selector，而不是编造一段看似合理的故事。

## 内置示例

首页提供了一组真实的主网交易，覆盖当前支持的主要类型：

| 示例 | 类型 | 看点 |
| --- | --- | --- |
| 恒定乘积的平衡 | Uniswap V2 交换 | 197.01 UNI 进入交易对，0.6436 WETH 流出；储备变化对应 `x × y = k`。 |
| 穿过流动性通道 | Uniswap V3 交换 | 383.54 USDC 进入池子，0.1534 WETH 从另一端流出，指针落在真实的终点 tick。 |
| ETH 的包装之旅 | ETH → WETH → USDC | 路由先把 ETH 包装为 WETH，完成交换后再处理退款。 |
| 十万亿 UNI，被拒绝 | 回滚交易 | 一次大额授权尝试失败，状态倒带，但 Gas 仍然发生。 |
| 一把通向 USDC 金库的万能钥匙 | 无限授权 | `approve(spender, max uint256)` 被呈现为一把授权钥匙。 |
| 1,500 USDT 的去向 | ERC-20 转账 | 由一条 `Transfer` 日志讲清代币从哪里来、到哪里去。 |
| 两枚 ETH 的转移 | ETH 转账 | 最简单、也最完整的一段价值转移。 |

## 播放体验与缓存

播放器按场景组织交易过程，支持暂停、继续、重播当前场景，以及从头重播整部短片。动画、进度条、计数器和延迟出现的元素共用同一个场景时钟，因此暂停时会停在同一帧，继续后不会跳过动画。

浏览器使用 TanStack Query 按 `chain + hash` 缓存已生成的影片。在同一个标签页内返回首页，再打开同一笔交易时，会直接恢复影片，不会重新进入加载画面或再次请求 RPC。缓存闲置 30 分钟后回收；刷新页面会清空这层浏览器内存缓存。

## 数据流与架构

```text
交易 Hash
  │
  ├─ TanStack Query：浏览器内的影片缓存与请求状态
  │
  ├─ viem：读取原始 JSON-RPC
  │     └─ /api/rpc：可选的同源代理与服务端 LRU 缓存
  │
  ├─ 解码：交易、回执、日志、调用数据
  ├─ 分类：识别转账、授权、V2/V3 交换、回滚等类型
  ├─ Story Builder：生成场景、角色、字幕与动画参数
  └─ Renderer：用 React 和 Framer Motion 播放影片
```

RPC 调用之后的处理链是纯函数：同一份冻结的交易 fixture，总能得到同一份 Story。这样线上数据与离线测试使用同一条解码路径。

### 设计原则

- **先有证据，再有叙事。** 动画参数来自交易数据：粒子数量来自金额规模，V2 储备液位来自真实储备，V3 指针终点来自真实 tick。
- **不依赖路由白名单。** ERC-20、V2 和 V3 的识别基于事件和调用数据，而不是特定 Router 地址。
- **回滚时不假装知道结果。** EVM 回滚不会保留事件日志。项目从调用数据推断用户意图；无法解码时展示原始 selector，而不是虚构失败原因。
- **归属要能验证。** 只有读取池子的 `factory()` 并确认后，界面才会标记为 Uniswap V3。
- **增强信息可以失败。** 代币元数据和池归属读取失败时，影片仍会播放，只是降级为原始金额和通用标签，并向用户说明原因。

## 技术栈

- Next.js 16（App Router）与 React 19
- TypeScript
- viem：Ethereum JSON-RPC、ABI 与数据格式化
- TanStack Query：浏览器端查询、缓存、重试与请求状态
- Tailwind CSS 4 与 Geist 字体
- Framer Motion：场景渲染；场景时间由播放器统一驱动
- Vitest 与 Playwright：基于冻结真实交易 fixture 的测试

## 本地运行

```bash
npm ci
npm run dev
```

然后打开 <http://localhost:3000>，输入任意已确认的以太坊主网交易 Hash。

常用命令：

```bash
npm test          # 单元测试
npm run test:e2e  # Playwright 冒烟测试
npm run build     # 生产构建
```

需要 Node.js `>= 20.9`，具体版本见 `.nvmrc`。

## RPC 配置

不配置环境变量也能运行：浏览器会依次尝试同源代理和公共 RPC 节点。

| 变量 | 用途 |
| --- | --- |
| `NEXT_PUBLIC_RPC_URL` | 浏览器可直接访问的 RPC 地址。它会被打进前端 bundle，不能放任何需要保密的 Key。 |
| `RPC_URL` | 仅服务端使用的 RPC 地址。浏览器请求会经由 `/api/rpc` 转发，适合带 Key 的节点服务。 |

`RPC_URL` 对应的同源代理会为上游请求设置超时，并缓存不可变数据：已确认交易、回执和指定区块。它是服务进程内的 LRU 缓存，重启、重新部署或切换实例后会失效。

## 目录说明

```text
src/app/                 页面、根 Provider 与同源 RPC 路由
src/components/          播放器、舞台、场景和视觉组件
src/lib/chain/           viem 客户端与网络配置
src/lib/fetch/           原始 RPC → 交易数据包
src/lib/decode/          日志、调用数据、代币与池信息解码
src/lib/classify/        交易类型识别规则
src/lib/story/           Story IR、场景 builder 与动画语义参数
src/lib/player/          播放器时钟与 TanStack Query 影片查询
src/fixtures/            冻结的真实交易 RPC 响应
tests/                   Vitest 测试
e2e/                      Playwright 冒烟测试
scripts/                  演示交易查找与 fixture 抓取脚本
```

## 新增一种交易类型

1. 在 `src/lib/decode/` 中补充事件或调用数据的解码。
2. 在 `src/lib/classify/kinds.ts` 中新增分类规则和 `TxKind` 分支。
3. 在 `src/lib/story/builders/` 中添加 builder，产出角色、字幕和 `Scene[]`。
4. 如果现有场景不够用，再扩展 `Scene` 联合类型并在 `SceneRenderer` 中实现渲染。
5. 用 `scripts/capture-fixture.mjs <hash>` 冻结原始 RPC 响应，再补充 fixture 测试。

不要在渲染组件里直接写与交易无关的动画常量。金额到粒子数、价格变动到指针范围等映射，应放在 story 层统一维护。

## 已知限制

- 目前仅支持以太坊主网。
- V2/V3 交换当前只覆盖单交易对或单池；多跳和聚合器会回退到“未知交易”。
- 公共 RPC 有速率限制。生产环境建议配置 `RPC_URL`。
- ERC-20 的名称、符号和精度以合约返回值为准；异常合约会如实展示，读取失败时会降级。
- 待打包交易没有回执，暂时无法生成完整影片。

## 部署与 CI

- GitHub Actions 会在每次 push 和 PR 上执行依赖安装、lint、单元测试、生产构建和 Playwright 冒烟测试。
- `next.config.ts` 配置了安全响应头。
- 可部署为标准 Next.js 应用（例如 Vercel）。若启用 `/api/rpc` 代理，需要 Node 或 Serverless 运行时，不能导出为纯静态站点。

## 相关项目

- [0x-lens](https://github.com/Sophran-fbj/0x-lens)：浏览器悬停查看地址身份、ENS、余额、EOA/合约属性与 EIP-7702 委托。
- [TxRay · sophran-tools](https://github.com/Sophran-fbj/sophran-tools)：面向 Ethereum、Base、Arbitrum 和 Optimism 的授权、调用数据与 EIP-712 签名风险检查工具。

## 许可

[MIT](./LICENSE)
