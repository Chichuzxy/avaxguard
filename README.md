# AvaxGuard - Avalanche 授权安全管家

> Built during Avalanche Builder Day @ Chengdu (2026-09-06)

## 团队信息 (Team)

- 项目名称: AvaxGuard (Avalanche 授权安全管家)
- 成员: [现场填写] (个人 / 队伍名)
- 联系方式: [GitHub: Chichuzxy]

## 1. 项目简介 (Project Overview)

扫描 USDC/USDT 在 Avalanche C-Chain 上的授权 (allowance),
规则引擎风险分级 + AI 润色报告, 签名前模拟预览, 一键 revoke, 链上秒确认。

## 2. 用户痛点 (Problem)

你的 USDC 授权给过十几个 dApp, 大多早不用了。
只要其中一个被黑, 你的资产就能被无限转走。
ERC-20 授权遗忘是链上资产被盗最高频的入口之一,
而大多数用户根本不知道如何检查或撤销授权。

## 3. 解决方案 (Solution)

| 模块 | 功能 | 用户价值 |
|------|------|----------|
| 授权扫描 | 批量读链上 allowance | 看清谁持有你的授权 |
| 风险分级 | 规则引擎 (严重/高/中/无) | 知道哪些危险 |
| AI 报告 | DeepSeek 润色中文建议 | 普通人看得懂 |
| 模拟预览 | eth_call 检查 revoke 可行性 | 签名前心里有数 |
| 一键 Revoke | approve(0) 链上执行 | 收回控制权 |
| 链上验证 | 回读 allowance 确认归零 | 证明 revoke 真实生效 |

## 4. 工作流程 (How it works)

连接钱包/输入地址 -> 扫描 allowance -> 规则引擎分级
-> DeepSeek AI 润色报告 -> 模拟预览 before/after
-> MetaMask 签名 revoke -> 链上确认 + 回读 allowance=0 验证

## 5. 项目创新 (Why different)

- 签名前模拟预览: eth_call 检查 approve(0) 是否成功, 展示预计执行后状态
- 真实链上动作: revoke 是链上状态变化, 有可验证 tx hash
- 链上回读验证: 交易确认后回读 allowance 证明归零 (不只查 receipt)
- 规则引擎兜底 + AI 润色: 断网也能出报告, AI 失败自动回退
- 熊猫暖色 UI: 成都活动限定主题

## 6. 与 Avalanche 的关系 (Why Avalanche)

- 部署在 Avalanche C-Chain (EVM), Fuji 测试网
- C-Chain 亚秒级最终性: revoke 交易秒确认 (Demo 亮点)
- Avalanche 稳定币生态 (USDC/USDT 机构级流动性), 授权风险真实高频
- 后续可扩展: L1 版本 / 跨链授权监控 (Teleporter)

## 7. 真实实现与证据 (Validation)

合约 (Fuji Testnet):
- MockUSDC: [部署后填地址]
- AllowanceScanner: [部署后填地址]
- 部署 tx: [部署后填 hash]
- Explorer: https://subnets-test.avax.network/c-chain

测试: forge test 5/5 通过 (截图见 evidence/)
证据目录: evidence/ (部署/扫描/revoke 截图 + JSONL 日志)

## 8. 技术栈 (Tech stack)

| 层 | 技术 |
|----|------|
| 合约 | Solidity 0.8.20 + Foundry |
| 后端 | Node.js 原生 http (零 npm 依赖) + fetch 直调 Fuji RPC |
| AI | DeepSeek (OpenAI 兼容接口, 规则引擎兜底) |
| 前端 | 原生 HTML/CSS/JS |
| 签名 | MetaMask (approve(0)) |

## 9. 目标用户 (Target users)

在 Avalanche C-Chain 上用过任何 dApp 的用户; 测试网新开发者 onboarding 工具。

## 10. 安全边界与后续计划 (Risks & Next)

安全边界:
- 后端不碰私钥, revoke 由用户钱包签名
- 仅 Fuji 测试网, 不上主网
- MockUSDC 为 demo 代币, 非生产
- 风险分级由规则引擎判定, AI 只润色措辞不改变结论

扫描边界 (诚实说明):
- ERC-20 allowance 需 owner + token + spender 三元组才能查询,
  链上无通用接口枚举全部 spender。当前版本扫描 curated spender 列表
  (演示预设 + RISK_SPENDERS 环境变量), 不做全量自动发现。
- 后续计划: 接入 Approval 事件 indexer / 区块索引服务, 实现全量扫描。

后续计划:
- 真实 USDC/USDT 地址库 + 定时授权监控告警
- 批量 revoke (多个 spender 一次处理)
- Approval event indexer 全量扫描
- 申请 Team1 Builder Grants 继续打磨

---

## 功能矩阵 (Feature matrix)

| 功能 | 状态 |
|------|------|
| 授权扫描 (多 token x 多 spender) | 已实现 |
| 风险分级 (严重/高/中/无) | 已实现 |
| AI 中文报告 (DeepSeek 润色 + 规则引擎兜底) | 已实现 |
| 模拟预览 (eth_call) | 已实现 |
| Revoke (MetaMask 签名) | 已实现 |
| 链上验证 (receipt + 回读 allowance) | 已实现 |
| 批量 revoke | 计划中 |

## 评分维度对齐 (Judging alignment)

| 维度 | 对应 |
|------|------|
| 创新性 | 签名前模拟预览 + 链上回读验证 + AI 润色 + Agent 授权安全定位 |
| 代码完整度 | contracts/ + backend/ + frontend/ + Foundry 测试 5/5 |
| Avalanche 相关性 | C-Chain EVM + 亚秒最终性演示 + Fuji 部署地址可验证 |
| 发展潜力 | Agent 经济授权基础设施 + 监控告警 + Builder Grants 路径 |

## 第三方资源声明 (Third-party resources)

- forge-std (Foundry 官方测试库)
- Solidity 编译器 / Foundry 工具链
- Node.js 原生模块 (无第三方 npm 依赖)
- MetaMask (钱包签名)
- DeepSeek API (AI 报告润色)
- AI 工具辅助开发 (Hermes Agent), 代码逻辑已人工复核
- 图标: 熊猫 emoji / 系统默认字体
