export default {
  id: "disk-full-logs",
  title: "磁盘写满，健康检查开始失败",
  service: "prod-api-03",
  difficulty: "入门",
  cwd: "/srv/app",
  tags: ["磁盘", "日志", "df / du"],
  parSeconds: 180,
  briefing:
    "凌晨 02:15 告警：prod-api-03 的数据盘使用率 100%，健康检查连续失败。应用进程还在，只是所有写入都返回 ENOSPC。这个服务只写本地目录，数据盘是一块 8 MiB 的 tmpfs。",
  symptoms: [
    "df 显示 /srv/app/data 已 100%",
    "health.sh 报 No space left on device",
    "审计日志 /srv/app/data/audit/audit.log 必须保留",
  ],
  goal: "释放数据盘空间，让健康检查重新通过，同时保留审计日志。",
  setup: [
    "mkdir -p /srv/app/data /srv/app/bin",
    "mount -t tmpfs -o size=8m tmpfs /srv/app/data",
    "mkdir -p /srv/app/data/logs /srv/app/data/audit",
    "dd if=/dev/zero of=/srv/app/data/logs/app.log.1 bs=1k count=6656 2>/dev/null",
    "head -c 4096 /dev/urandom > /srv/app/data/audit/audit.log",
    "printf 'service=ok\\n' > /srv/app/data/state",
    "printf '#!/bin/sh\\ndd if=/dev/zero of=/srv/app/data/.probe bs=1k count=2048 2>/dev/null\\nrc=$?\\nrm -f /srv/app/data/.probe\\nexit $rc\\n' > /srv/app/bin/health.sh",
    "chmod +x /srv/app/bin/health.sh",
  ],
  checks: [
    {
      label: "健康检查能写入 2 MiB",
      sh: "/srv/app/bin/health.sh",
    },
    {
      label: "审计日志仍然存在",
      sh: "test -s /srv/app/data/audit/audit.log",
    },
  ],
  hints: [
    "df -h /srv/app/data 看整体，du -ah /srv/app/data | sort -h 找大头。",
    "轮转日志 app.log.1 只是历史副本，删掉或清空它不会丢当前数据。",
    "truncate -s 0 <file> 可以保留文件、释放空间。",
  ],
};
