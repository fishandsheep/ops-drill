export default {
  id: "config-drift",
  title: "配置被覆盖，服务降级到调试模式",
  service: "prod-api-11",
  difficulty: "进阶",
  cwd: "/srv/app",
  tags: ["配置", "diff", "恢复"],
  parSeconds: 150,
  briefing:
    "自动化脚本执行到一半失败，把生产配置覆盖成了模板。服务仍在运行，但以 debug 模式连接本地数据库，健康检查判定为不可用。上一次发布前的备份还在机器上。",
  symptoms: [
    "app.conf 里是 APP_MODE=debug、DB_HOST=localhost",
    "health.sh 要求 production 且连接 db-prod",
    "/srv/backup/app.conf.bak 是上次发布前的备份",
  ],
  goal: "恢复正确的生产配置，让健康检查通过。不要重启整台机器。",
  setup: [
    "mkdir -p /srv/app/etc /srv/app/bin /srv/backup",
    "printf 'APP_MODE=debug\\nDB_HOST=localhost\\n' > /srv/app/etc/app.conf",
    "printf '# deployed 2026-11-18\\nAPP_MODE=production\\nDB_HOST=db-prod\\n' > /srv/backup/app.conf.bak",
    "printf '#!/bin/sh\\n. /srv/app/etc/app.conf\\n[ \"$APP_MODE\" = production ] || exit 1\\n[ \"$DB_HOST\" = db-prod ] || exit 1\\n' > /srv/app/bin/health.sh",
    "chmod +x /srv/app/bin/health.sh",
  ],
  checks: [
    {
      label: "健康检查通过（production / db-prod）",
      sh: "/srv/app/bin/health.sh",
    },
    {
      label: "备份文件没有被破坏",
      sh: "grep -q '^APP_MODE=production$' /srv/backup/app.conf.bak",
    },
  ],
  hints: [
    "diff /srv/app/etc/app.conf /srv/backup/app.conf.bak 一眼看出差别。",
    "恢复配置只需要覆盖文件，不需要动内核或重启机器。",
    "cp /srv/backup/app.conf.bak /srv/app/etc/app.conf",
  ],
};
