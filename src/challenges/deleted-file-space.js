export default {
  id: "deleted-file-space",
  title: "日志删了，磁盘还是满的",
  service: "prod-api-05",
  difficulty: "进阶",
  tags: ["磁盘", "文件描述符", "/proc"],
  cwd: "/srv/app",
  parSeconds: 240,
  briefing:
    "凌晨告警：/srv/app/data 使用率 81%，健康检查写不进 2 MiB 的探测文件。值班同事已经把 6.5 MiB 的 app.log 删掉了，df 却一点没降——有个进程还开着这个文件的描述符。",
  symptoms: [
    "df 显示已用 6.5 MiB，du 却找不到大文件",
    "app.log 已经不存在",
    "健康检查写入失败",
  ],
  goal: "释放被占用的空间，让健康检查重新通过。不要直接扩容。",
  setup: [
    "mkdir -p /srv/app/data /srv/app/bin",
    "mount -t tmpfs -o size=8m tmpfs /srv/app/data",
    "mkdir -p /srv/app/data/logs",
    "dd if=/dev/zero of=/srv/app/data/logs/app.log bs=1k count=6656 2>/dev/null",
    "printf '#!/bin/sh\\ndd if=/dev/zero of=/srv/app/data/.probe bs=1k count=2048 2>/dev/null\\nrc=$?\\nrm -f /srv/app/data/.probe\\nexit $rc\\n' > /srv/app/bin/health.sh",
    "chmod +x /srv/app/bin/health.sh",
    "sh -c 'exec 3</srv/app/data/logs/app.log; sleep 600' >/dev/null 2>&1 &",
    "sleep 0.4",
    "rm -f /srv/app/data/logs/app.log",
  ],
  checks: [{ label: "健康检查能写入 2 MiB", sh: "/srv/app/bin/health.sh" }],
  hints: [
    "ls -l /proc/*/fd 2>/dev/null | grep app.log 能找到还开着它的进程。",
    "deleted 状态的文件在 /proc/<pid>/fd 里会带 (deleted)。",
    "结束那个进程，空间才会真正归还。",
  ],
};
