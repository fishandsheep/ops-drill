export default {
  id: "hosts-drift",
  title: "数据库连不上，域名解析到了旧库",
  service: "prod-worker-02",
  difficulty: "进阶",
  cwd: "/srv/app",
  tags: ["网络", "DNS", "/etc/hosts"],
  parSeconds: 180,
  briefing:
    "prod-worker-02 的消费任务全部失败，日志显示连接 db.internal 被拒绝。数据库上周已经从 10.0.0.99 迁到 10.0.0.10，但一次主机初始化把旧的 /etc/hosts 覆盖回来了。DNS 里没有这条记录，解析完全依赖本机 hosts。",
  symptoms: [
    "ping db.internal 解析到 10.0.0.99，不是新库 10.0.0.10",
    "应用日志：connect to db.internal:5432 refused",
    "10.0.0.99 上的旧库已经下线",
    "bin/db-check.sh 退出码为 1",
  ],
  goal: "把 db.internal 指向 10.0.0.10，恢复应用的数据库解析。",
  setup: [
    "mkdir -p /srv/app/bin",
    "ip link set dummy0 up 2>/dev/null || true",
    "ip addr add 10.0.0.5/24 dev dummy0 2>/dev/null || true",
    `printf '127.0.0.1 localhost\\n# 2026-11-18 主机初始化后写入的旧地址\\n10.0.0.99 db.internal\\n' > /etc/hosts`,
    `cat > /srv/app/bin/db-check.sh <<'SH'
#!/bin/sh
addr=$(ping -c 1 -W 1 db.internal 2>&1 | sed -n 's/^PING db\\.internal (\\([0-9.]*\\)).*/\\1/p' | head -n 1)
if [ "$addr" != "10.0.0.10" ]; then
  echo "db.internal -> \${addr:-unresolved} (expected 10.0.0.10)" >&2
  exit 1
fi
echo "db.internal -> $addr"
SH`,
    "chmod +x /srv/app/bin/db-check.sh",
  ],
  checks: [
    {
      label: "db.internal 解析到 10.0.0.10",
      sh: "/srv/app/bin/db-check.sh",
    },
    {
      label: "解析结果不再是旧库 10.0.0.99",
      sh: "! ping -c 1 -W 1 db.internal 2>&1 | grep -q 10.0.0.99",
    },
  ],
  hints: [
    "先确认解析结果：ping db.internal 或 cat /etc/hosts。",
    "这条记录不在 DNS 里，hosts 文件就是唯一来源。",
    "改 hosts 时保留 localhost 那一行，只修正 db.internal 的地址。",
  ],
};
