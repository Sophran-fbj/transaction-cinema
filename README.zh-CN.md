# Transaction Cinema

[English](./README.md) | 简体中文

[![CI](https://github.com/Sophran-fbj/transaction-cinema/actions/workflows/ci.yml/badge.svg)](https://github.com/Sophran-fbj/transaction-cinema/actions/workflows/ci.yml)

**把任意一笔链上交易，变成一段简短的动画故事。**

粘贴一个主网交易哈希，按下播放，看一段 11–15 秒的短片：价值在钱包之间飞掠，
流动性隧道吞入又吐出，失败的交易倒带重演——而 gas 照样被扣走。无需连接钱包、
不用任何索引 API：屏幕上每一个数字，都是本应用从原始 JSON-RPC 数据里解码出来的。

## 概览

| | |
|---|---|
| **问题** | 一笔交易就是一堆原始十六进制：receipt、log 和 calldata。想读懂它，就得手动解码事件和调用参数。 |
| **做了什么** | 一个播放器，把一笔主网交易变成 11–15 秒的动画短片，全部由原始 JSON-RPC 解码而来——不用索引 API，不用钱包。 |
| **技术栈** | Next.js 16（App Router）· React 19 · TypeScript · viem · Tailwind CSS v4 · Framer Motion · vitest |
| **怎么试** | `npm run dev`，然后粘贴任意以太坊主网交易哈希——无需连接钱包，无需 API key |
| **测试** | 52 个 vitest 测试，跑在冻结的真实交易 fixture 上，完全离线 |

## 正在放映（全部为真实主网交易）

| 影片 | 类型 | 剧情 |
|---|---|---|
| 穿过流动性隧道 | Uniswap V3 swap | 383.54 USDC 进入 V3 池；价格指针停在真实的终点 tick；0.1534 WETH 流出 |
| ETH 穿过包装之门 | ETH 桥接的 V3 swap | 路由把 ETH 包装成 WETH，400 USDC 流出，找零退回——通过中继的 WETH 腿识别出来 |
| 十万亿 UNI，被拒绝 | 失败交易 | 一次巨额授权被尝试；世界说不；一切倒带——除了 gas |
| 一把打开 USDC 金库的无限钥匙 | 授权 | `approve(spender, max uint256)`——那张签了名的空白支票，被具象成一把金库钥匙 |
| 一千五百 USDT | ERC20 转账 | 代币移动，ETH 不动；一个 Transfer 事件讲完整个故事 |
| 两枚 ETH，口袋到口袋 | ETH 转账 | 最小的完整故事 |

## 支持范围

| 交易类型 | 故事 | 状态 |
|---|---|---|
| ETH 原生转账 | 完整影片 | ✅ 已支持 |
| ERC20 转账 | 完整影片 | ✅ 已支持 |
| ERC20 授权（限额 / 无限 / 撤销） | 完整影片 | ✅ 已支持 |
| Uniswap V3 swap（单池，任意路由） | 完整影片 | ✅ 已支持 |
| ETH 桥接的 V3 swap（路由包装/解包 WETH） | 完整影片 | ✅ 已支持 |
| 带可解码 calldata 的回滚交易 | 尝试 → 被拒 → 倒带 | ✅ 已支持 |
| Uniswap V2 swap、多跳 V3、聚合器 | — | 🚧 计划中 |
| ERC721 / ERC1155 转账 | — | 🚧 计划中 |
| 合约创建、任意合约调用 | 通用的 receipt 取景 | 🚧 计划中 |
| 其他链（Base、Arbitrum、Optimism） | — | 🚧 计划中 |
| 规则无法分类的任何东西 | 诚实的「未知」影片，附原始 selector | ⛔ 绝不编造 |

这个兜底本身就是特性：当流水线读不懂一笔交易时，它会如实说明并展示原始 4 字节
selector，而不是编一个故事出来。

## 架构

一条纯函数流水线。RPC 调用之后的每一个阶段都是确定性的，并且跑在冻结的真实交易
fixture 上做测试。

```
raw JSON-RPC  ──►  decode      ──►  classify        ──►  story builder    ──►  renderer
(getTransaction,   (events +        (rule engine →         (kind → Scene[]    (React + Framer
 receipt, block)    calldata         discriminated          IR + cast +        Motion, knows
                    intent)          union TxKind)          captions)          only Scene types)
```

关键性质：

- **事件驱动的分类。** 一个 ERC20 Transfer 事件可以匹配任意 emitter，一个 V3 Swap
  事件自带完整的终态——所以故事不需要 trace、归档节点或路由白名单就能讲出来
  （演示用 swap 经由 Universal Router 路由；检测器从不需要知道这件事）。
- **Story IR 把数据和戏剧性分开。** `Scene[]` 是渲染层唯一理解的东西。动画参数
  （粒子数量、液面高度、指针扫动）都在 story 层由真实数值算出，所以每一个动画都有
  存在的语义理由——V3 指针的扫动长度来自真实成交规模（`tickSpanFor`），它的终点
  就是真实的终点 tick。
- **回滚的交易没有 log**——事件在 revert 时被丢弃。它们的故事由 calldata 意图构建
  （`decodeFunctionData` + 一个诚实的 `unknown` 兜底，展示原始 4 字节 selector 而不是
  假装知道）。替代方案——从 trace 里读 revert 原因——需要大多数公共端点限流的归档
  节点方法，而主网上的 revert 本来也不携带可解码的事件；用户实际签名的，就是那个意图。
- **诚实的归属。** V3 池在各分叉上字节码完全相同，所以只有向池子询问 `factory()`
  之后，才会声称它是「Uniswap V3」。
- **增强是可选的。** 代币元数据和池归属都是尽力而为（`enrichBundle` 里的
  `Promise.allSettled`）：如果在基础 bundle 就绪后这些调用失败，影片照样播放——用
  原始数量和通用标签——并且 UI 会说明这一点，并提供重试。

### 各模块位置

```
src/lib/chain/         RPC 客户端 + 链（感知浏览器代理）
src/lib/fetch/         getTxBundle（RPC → bundle）、fixtures
src/lib/decode/        log/calldata 解码、代币与池归集
src/lib/classify/      规则引擎 → 可辨识联合 TxKind
src/lib/story/         Story IR 类型 + 每个 TxKind 一个 builder
src/lib/story/semantics.ts   数量 → 动画参数映射
src/components/scenes/ 每种 Scene 一个「哑」渲染组件
src/components/stage/  播放器外壳（Stage、时间线、字幕）
src/app/api/rpc/       同源 RPC 代理（可选，服务端专属 key）
tests/                 跑在冻结真实交易 fixture 上的 vitest 套件
scripts/               fixture 抓取 + 演示交易查找器
```

## 什么是真实的，什么是戏剧化的

这是本项目的一条核心纪律：如果一个动画无法映射到数据，它就是装饰，会被砍掉。

| 真实（来自 RPC） | 戏剧化（刻意风格化） |
|---|---|
| 数量、地址、gas × 价格、区块、时间戳 | 粒子飞行轨迹 |
| V3 终点 tick / sqrtPriceX96 / 活跃流动性 | 指针扫动长度（由真实成交规模推导；终点是真实的） |
| 由实际数量算出的成交价 | 通道辉光强度（真实流动性的对数） |
| 池费率档位 + factory 归属 | 储罐/隧道/虚空 的视觉语言 |
| 失败交易上的「尝试」措辞 | 倒带编排 |

## 技术

Next.js 16（App Router）· React 19 · TypeScript · viem · Tailwind CSS v4 ·
Framer Motion · vitest（52 个测试，fixture 驱动，完全离线）

## 运行

```bash
npm ci             # Node >= 20.9（见 .nvmrc）
npm run dev        # http://localhost:3000
npm test           # 52 个测试，跑在冻结的真实交易 fixture 上
npm run build      # 完全离线——字体是自托管的
```

### RPC 配置

零配置即可工作：浏览器会在一串公共端点之间依次回退。两个可选开关
（见 `.env.example`）：

- `NEXT_PUBLIC_RPC_URL` —— 一个直接从浏览器访问的端点，在公共回退端点之前尝试
  （在代理之后）。**它会被内联进客户端 bundle，每个访客都能看到。绝不要把需要保密
  的 key 放在这里。**
- `RPC_URL` —— **仅服务端**。设置后，浏览器请求会经由同源代理
  `src/app/api/rpc/route.ts` 转发，从而把 key 挡在客户端之外，为上游调用设置超时
  （15 秒），并把不可变读取（已打包的交易、receipt、历史区块）缓存进一个小型 LRU。
  凡涉及 key 的场景，推荐用这套配置。

## 脚本

```
scripts/find-*.mjs          扫描主网，为每种类型寻找演示交易
scripts/capture-fixture.mjs 把一笔交易的原始 RPC 响应冻结成测试 fixture
```

## 为什么不用 Etherscan

RPC-first 架构：不用索引 API（Etherscan/Covalent/Moralis），不用元数据 API
（代币图标由地址确定性生成），不用美元价格（只显示原始数量）。应用只跟普通
JSON-RPC 端点对话，其余全部自己解码。这让依赖面收敛到一个原语，让屏幕上每个值都
可回溯到 `eth_getTransaction*` 的响应，也让解码流水线在离线（fixture）和在线两种
情况下行为完全一致——不存在第二个可能漂移的数据源。

## 已知限制

- **单链。** 仅以太坊主网；路由会校验 `/play/eth/…`，其他一切在一开始就被拒绝。
- **多 log 的复杂交易会被简化。** 一笔触及多个池的 swap，只讲它最大的那条腿，而不是
  每一跳；聚合器尚未做归属。
- **公共 RPC 限流。** 未设置 `RPC_URL` 时，连续播放可能触到公共端点配额；UI 提供
  重试，增强失败会降级而不是整体失败。
- **元数据假设。** ERC20 的 `name/symbol/decimals` 就是合约返回什么就是什么；一个
  撒谎的合约会被原样展示。当 multicall 失败时，数量以原始形式显示（18 位小数的假设
  会在屏幕上标注出来）。
- **上链之前没有 receipt。** 待打包的交易还没有故事——播放器会解释原因并提供重试。

## 新增一种交易类型

1. **Decode** —— 如果需要新的事件/Calldata 解析，扩展 `src/lib/decode/`
   （纯函数：原始结构 → 带类型的信号）。
2. **Classify** —— 在 `src/lib/classify/kinds.ts` 加一条规则；`TxKind` 是可辨识联合，
   编译器会替你追踪穷尽性。
3. **Story** —— 在 `src/lib/story/builders/` 加一个 builder，并注册到注册表
   （`src/lib/story/build.ts`）。产出 `Scene[]` + 角色 + 字幕；动画参数通过
   `src/lib/story/semantics.ts` 推导，绝不要在渲染层内联魔法数字。
4. **Render** —— 如果现有场景组件覆盖不到，就在 `src/lib/story/types.ts` 的 `Scene`
   联合里加一个场景变体，并在 `SceneRenderer` 加一个 case（这个 switch 是穷尽的——
   少了 case 就编译不过）。
5. **冻结 fixture** —— `scripts/capture-fixture.mjs <hash>` 会把原始 RPC 响应写进
   `src/fixtures/`，然后在 `tests/` 里加一个测试。

## 部署与 CI

- GitHub Actions（`.github/workflows/ci.yml`）：每次 push/PR 执行
  `npm ci → lint → test → build`，并锁定到 `.nvmrc` 里的 Node 版本。
- 安全响应头（nosniff、严格 referrer、frame-deny、权限锁定）在 `next.config.ts`
  里设置。
- 以标准 Next.js 应用部署（例如 Vercel）；RPC 代理路由需要 Node/serverless 运行时，
  不能走静态导出。

## 我的其他项目

另外两个项目回答同一个问题的其余部分——三者都是 RPC-first、基于 viem 构建，并宁愿
给出诚实的兜底，也不愿编造答案：

- **[0x-lens](https://github.com/Sophran-fbj/0x-lens)** —— *这个地址是谁？*
  一个 Chrome 扩展，悬停即可显示链上身份：ENS、余额、EOA / 合约、以及 EIP-7702
  委托，且不触碰宿主页面。
- **[TxRay · sophran-tools](https://github.com/Sophran-fbj/sophran-tools)** —— *这笔
  授权安全吗？* 覆盖以太坊、Base、Arbitrum、Optimism 的授权、calldata 与 EIP-712
  签名风险检查。

## 许可证

[MIT](./LICENSE)
