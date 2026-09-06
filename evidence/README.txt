evidence 目录 - 现场需要收集的证据清单
====================================================
【一、必收证据 (6 项, 每项截图+存文本)】

1. 合约部署证据
   - 文件: 1_deploy_tx.txt
   - 内容: MockUSDC 地址 + AllowanceScanner 地址 + 部署 tx hash
   - 来源: forge script 部署输出 + Fuji 浏览器
   - 截图: 01_deploy.png (部署命令输出 + 浏览器合约页)

2. 扫描结果证据
   - 文件: 2_scan_result.txt
   - 内容: /api/scan 返回的 JSON (含 critical 无限授权 + medium 500)
   - 截图: 02_scan.png (前端扫描结果页, 红橙两色卡片)

3. AI 报告证据
   - 文件: 3_report_output.txt
   - 内容: AI 润色后的中文报告一句话
   - 截图: 03_report.png (前端报告显示)

4. 模拟预览证据
   - 文件: 4_preview_result.txt
   - 内容: preview 返回 (before ∞ → after 0, verdict READY_TO_REVOKE)
   - 截图: 04_preview.png (前端预览显示)

5. Revoke 交易证据
   - 文件: 5_revoke_tx.txt
   - 内容: revoke tx hash + verify 结果 (revokeConfirmed: true)
   - 截图: 05_revoke.png (前端 revoke 成功 + 链上回读确认)

6. 测试证据
   - 文件: 6_forge_test.txt
   - 内容: forge test 输出 (5/5 passed)
   - 截图: 06_test.png (终端测试结果)

【二、运行日志】
- 文件: events_现场.jsonl
- 内容: backend/events.jsonl 备份 (scan/preview/report/verify 全链路记录)
- 这是"可复查证据", 评委能逐条看到每次操作

【三、截图命名规范】
用 0X_名字.png 命名:
01_deploy.png   部署
02_scan.png     扫描
03_report.png   报告
04_preview.png  预览
05_revoke.png   revoke
06_test.png     测试
07_ui_home.png  首页 UI (可选)

【四、存放位置】
全部放 evidence/ 目录, 提交 GitHub 仓库。
README 里引用这些证据文件路径, 评委点开就能看。

【五、现场收集节奏 (关键)】
每完成一步立即截图+记录, 不要等全部做完再补。
顺序: 部署 → 扫描 → 报告 → 预览 → revoke → 测试
