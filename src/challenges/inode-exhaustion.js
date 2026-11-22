export default {
  id: "inode-exhaustion",
  title: "空间还有，但一个文件都写不进去",
  service: "prod-batch-02",
  difficulty: "进阶",
  tags: ["inode", "tmpfs", "df"],
  cwd: "/srv/app",
  parSeconds: 180,
  briefing:
    "批处理服务从 01:40 开始持续报 No space left on device，但值班同事看 df -h 发现数据盘还有 80% 空闲。tmpfs 的容量没满，能用的 inode 用完了：临时会话文件太多。",
  symptoms: [
    "df -h /srv/app/data 显示还有空间",
    "写入任何新文件都返回 ENOSPC",
    "df -i 显示 Inodes 已 100%",
  ],
  goal: "释放 inode，让服务能重新创建文件，同时保留 /srv/app/data/tmp/KEEP。",
  setup: [
    "mkdir -p /srv/app/data /srv/app/bin",
    "mount -t tmpfs -o size=8m,nr_inodes=64 tmpfs /srv/app/data",
    "mkdir -p /srv/app/data/tmp",
    "printf 'do not delete\\n' > /srv/app/data/tmp/KEEP",
    "i=0; while [ $i -lt 90 ]; do touch /srv/app/data/tmp/session-$i 2>/dev/null || true; i=$((i+1)); done",
    "printf '#!/bin/sh\\n: > /srv/app/data/.probe 2>/dev/null\\nrc=$?\\nrm -f /srv/app/data/.probe\\nexit $rc\\n' > /srv/app/bin/health.sh",
    "chmod +x /srv/app/bin/health.sh",
  ],
  checks: [
    { label: "服务能重新创建文件", sh: "/srv/app/bin/health.sh" },
    { label: "KEEP 文件仍然存在", sh: "test -s /srv/app/data/tmp/KEEP" },
  ],
  hints: [
    "df -h 看容量，df -i 看 inode，两个都要看。",
    "find /srv/app/data/tmp -type f | wc -l 看临时文件堆了多少。",
    "只清 session-*，KEEP 要留下。",
  ],
};
