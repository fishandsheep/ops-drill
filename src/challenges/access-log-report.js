export default {
  id: "access-log-report",
  title: "从访问日志里找出攻击来源",
  service: "prod-edge-01",
  difficulty: "入门",
  tags: ["文本处理", "awk", "排序"],
  cwd: "/srv/app/data",
  parSeconds: 180,
  briefing:
    "网关在凌晨遭到一轮扫描，值班同事需要你在五分钟内给出结论：哪个客户端 IP 请求最多，发了多少次。日志就在当前目录，报告写到 /srv/app/report.txt。",
  symptoms: [
    "access.log 里有 11 条请求",
    "同一 IP 反复请求 /health 和 /login",
    "需要给出“IP 次数”格式的结论",
  ],
  goal: "把请求次数最多的 IP 和次数写入 /srv/app/report.txt，格式为：IP 空格 次数（一行，结尾换行）。",
  setup: [
    "mkdir -p /srv/app/data",
    "printf '%s\\n' '198.51.100.4 - - [22/Nov/2026:02:10:01 +0000] \"GET /health HTTP/1.1\" 200 2' '203.0.113.7 - - [22/Nov/2026:02:10:03 +0000] \"GET /login HTTP/1.1\" 401 0' '203.0.113.7 - - [22/Nov/2026:02:10:04 +0000] \"POST /login HTTP/1.1\" 401 0' '192.0.2.9 - - [22/Nov/2026:02:10:05 +0000] \"GET / HTTP/1.1\" 200 512' '203.0.113.7 - - [22/Nov/2026:02:10:07 +0000] \"GET /admin HTTP/1.1\" 403 0' '198.51.100.4 - - [22/Nov/2026:02:10:09 +0000] \"GET /health HTTP/1.1\" 200 2' '203.0.113.7 - - [22/Nov/2026:02:10:11 +0000] \"POST /login HTTP/1.1\" 401 0' '192.0.2.9 - - [22/Nov/2026:02:10:12 +0000] \"GET /health HTTP/1.1\" 200 2' '203.0.113.7 - - [22/Nov/2026:02:10:15 +0000] \"GET /admin HTTP/1.1\" 403 0' '198.51.100.4 - - [22/Nov/2026:02:10:18 +0000] \"GET /health HTTP/1.1\" 200 2' '203.0.113.7 - - [22/Nov/2026:02:10:21 +0000] \"POST /login HTTP/1.1\" 401 0' > /srv/app/data/access.log",
  ],
  checks: [
    {
      label: "report.txt 内容是“IP 次数”",
      sh: '[ "$(cat /srv/app/report.txt 2>/dev/null)" = "203.0.113.7 6" ]',
    },
    {
      label: "report.txt 只有一行",
      sh: '[ "$(wc -l < /srv/app/report.txt 2>/dev/null)" = "1" ]',
    },
    {
      label: "原始日志没有被修改",
      sh: '[ "$(wc -l < /srv/app/data/access.log)" = "11" ]',
    },
  ],
  hints: [
    "awk '{print $1}' access.log 先取出 IP 列。",
    "sort | uniq -c | sort -rn 是最常用的组合。",
    "写入时用 awk '{print $2, $1}' 把次数放到 IP 后面。",
  ],
};
