# OPS/DRILL

每天两个真实 Linux 生产故障。打开页面就是一台真实内核，故障由脚本现场布置，
验收直接检查文件系统；输入第一个字符开始计时，全部通过后结算上榜。

题库目前 14 道，覆盖磁盘 / inode / 文件描述符 / 权限 / 进程与锁 / 配置 /
软链接 / 换行符 / 文本处理 / 端口 / 监听地址 / 解析 / 路由。终端会直接开在
题目需要的工作目录（例如 `/srv/app`），不需要自己 `cd`。

| 现场 | 方向 |
| --- | --- |
| 磁盘写满，健康检查开始失败 | 磁盘 / 日志 |
| 空间还有，但一个文件都写不进去 | inode / tmpfs |
| 日志删了，磁盘还是满的 | 文件描述符 / /proc |
| 热修之后，应用写盘全部被拒 | 用户 / 权限 |
| 发布脚本没有执行权限 | exec 位 |
| 配置被覆盖，服务降级到调试模式 | 配置恢复 |
| 上次发布留下的锁，卡住了整条流水线 | 进程 / 锁 |
| 切了发布，流量还在旧版本上 | 软链接 |
| 脚本在 Windows 上改过，Linux 跑不起来 | CRLF |
| 从访问日志里找出攻击来源 | awk / 文本处理 |
| 发布后 API 起不来，8080 被占用 | 端口 / 进程 |
| 本机健康，负载均衡却连不上 | 监听地址 / 网卡 |
| 数据库连不上，域名解析到了旧库 | /etc/hosts / 解析 |
| 管理网段失联，监控采不到数 | 路由表 / ip route |

## 本地运行

```sh
npm install
npm run dev        # 前端，默认 5173
npm run api        # 排行榜 API + 静态站，8787（另一个终端）
```

不启动 `npm run api` 也能玩：前端会自动降级成本地榜（localStorage），
页面顶部会标明「本地榜」。

```sh
npm test           # 24 个测试
npm run build
npm start          # 8787，同时服务 dist/ 和 /api
```

## 部署到服务器

需要 Node 22+ 和 HTTPS（Caddy 或 nginx 都行）。应用本身只提供 HTTP，
把 TLS 和域名交给反向代理。

```sh
# 1. 系统和用户
sudo useradd --system --home /opt/ops-drill --shell /usr/sbin/nologin opsdrill
sudo mkdir -p /opt/ops-drill /var/lib/ops-drill
sudo chown -R opsdrill:opsdrill /opt/ops-drill /var/lib/ops-drill

# 2. 代码和构建（在项目目录里）
sudo -u opsdrill npm ci
sudo -u opsdrill npm run build

# 3. systemd（文件在 deploy/ops-drill.service）
sudo cp deploy/ops-drill.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ops-drill
curl -s http://127.0.0.1:8787/api/health

# 4. Caddy（文件在 deploy/Caddyfile，替换域名）
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

默认配置：

- 应用监听 `127.0.0.1:8787`，只暴露给反向代理；防火墙只开 80/443。
- 数据在 `/var/lib/ops-drill/`：`scores.json` 是排行榜，`secret` 用来签计时
  token。两者都要备份；丢了 `secret` 只影响进行中的计时，不影响已有成绩。
- 反向代理必须传 `X-Forwarded-For`（Caddy 默认传），限流按真实 IP 计算。
- 健康检查：`GET /api/health`。
- 升级：拉代码 → `npm ci` → `npm run build` → `sudo systemctl restart ops-drill`。

静态资源里 wasm 约 10 MB（gzip 后约 4 MB）；Caddy 的 `encode` 会压缩，
首次加载后由浏览器缓存。没有 CDN 也能跑，但建议放在 CDN 后面。

## 每日排期

`src/challenges/index.js` 的 `challengesForDate()` 用日期当种子从题库里
轮换出**每天 2 道**，首页展示今日现场和全部题库。加题只需要新增文件并注册到
`challenges` 数组，不用维护日期表。

## 题目结构

```js
export default {
  id: "disk-full-logs",
  title: "磁盘写满，健康检查开始失败",
  service: "prod-api-03",
  difficulty: "入门",           // 入门 / 进阶 / 困难
  tags: ["磁盘", "日志", "df / du"],
  cwd: "/srv/app",              // 进入现场后终端的工作目录
  parSeconds: 180,              // 页面显示的参考时间，不参与排名
  briefing: "值班视角的事故描述……",
  symptoms: ["现象 1", "现象 2"],
  goal: "一句话说清恢复标准。",
  setup: ["mount -t tmpfs ...", "dd ..."],   // 真实命令，把环境弄坏
  checks: [{ label: "健康检查通过", sh: "/srv/app/bin/health.sh" }],
  hints: ["线索 1", "线索 2"],
};
```

验收必须满足两条：

1. `setup` 跑完后至少有一项 `check` 失败；
2. 修好之后所有 `check` 都能通过。

`test/challenges.test.mjs` 会把每道题完整跑一遍：启动真实内核 → 执行 setup →
确认故障存在 → 执行参考解法 → 确认全部验收通过。参考解法只放在 `test/`，
不会进前端 bundle。新题加进来就会被这个测试盯住。

## 计时与排行榜

- 计时从用户输入的**第一个字符**开始；前端立刻显示，同时向
  `POST /api/attempts` 申请一个带 HMAC 签名的 attempt token。
- 结算时 `POST /api/scores` 只提交 token 和昵称，**服务端用自己的时钟**
  计算用时，不接受客户端上报的时间。
- 同题同昵称只保留最好成绩；token 一次性使用；按 IP 限流
  （每分钟 40 次尝试、15 次提交）。
- 防作弊边界：验收在浏览器里执行，服务端只保证计时真实。这不是监考系统；
  公开运营前如果要防刷，需要账号体系或服务端复核。

## 目录

```
index.html                 入口
src/main.js                路由、内核启动、计时、验收、结算
src/challenges/            题库，每题一个文件
src/challenges/index.js    每日排期和日期工具
src/course-logic.js        终端输入行跟踪（退格 / 粘贴 / 方向键）
src/leaderboard.js         排行榜客户端（API / localStorage 回退）
src/style.css              UI
server/index.mjs           静态站 + 排行榜 API（无第三方依赖）
deploy/                    systemd unit 和 Caddyfile 示例
test/challenges.test.mjs   每道题的故障 → 修复 → 验收回归
test/network.test.mjs      基础镜像的网络能力（回环 / nc / dummy0）
test/server.test.mjs       API、token、排名、静态头与 MIME
test/input.test.mjs        终端输入跟踪
examples/                  上一版“跟打式教程”的素材，未参与构建
```

## 已知限制

- 内核跑在页面主线程（inline 模式），计算会占用 UI；后续可切 `worker: true`。
- 网络题只在回环和 `dummy0` 上跑，不访问外网；没有 `ss`/`iptables`，
  题目用 `netstat`、`/proc/net/tcp`、`nc`、`ip route` 完成。
- 服务类题目用 shell 循环模拟常驻进程，不是真正的 systemd；讲的是排查路径。
- 需要 JSPI：Chrome / Edge 137+、Firefox 153+、Safari 27+。
- 排行榜数据是单个 JSON 文件，写入用临时文件 + rename；单机够用，
  多实例部署需要换成共享存储。
- 限流在进程内存里，重启清零。

## 许可

`unkernel` 的 SDK 是 MIT，内核 wasm 是 GPL-2.0-only；分发 `dist/` 里的
内核时需按 GPLv2 提供对应源码：<https://github.com/pithings/unkernel>。
