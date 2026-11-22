export default {
  id: "symlink-release",
  title: "切了发布，流量还在旧版本上",
  service: "prod-web-08",
  difficulty: "入门",
  tags: ["软链接", "发布", "readlink"],
  cwd: "/srv/app",
  parSeconds: 120,
  briefing:
    "新版本已经解压到 releases/2026-11-22，但 current 链接还指向 11 月 1 日的目录。发布脚本显示成功，实际健康检查读到的还是旧 VERSION。",
  symptoms: [
    "readlink current 指向 releases/2026-11-01",
    "current/VERSION 是 2026.11.01",
    "新版本目录已经存在",
  ],
  goal: "把 current 指向新版本，让健康检查通过，并保留旧版本目录。",
  setup: [
    "mkdir -p /srv/app/releases/2026-11-01 /srv/app/releases/2026-11-22 /srv/app/bin",
    "printf '2026.11.01\\n' > /srv/app/releases/2026-11-01/VERSION",
    "printf '2026.11.22\\n' > /srv/app/releases/2026-11-22/VERSION",
    "ln -s /srv/app/releases/2026-11-01 /srv/app/current",
    "printf '#!/bin/sh\\ntest \"$(cat /srv/app/current/VERSION)\" = 2026.11.22\\n' > /srv/app/bin/health.sh",
    "chmod +x /srv/app/bin/health.sh",
  ],
  checks: [
    { label: "current 指向新版本", sh: "/srv/app/bin/health.sh" },
    { label: "旧版本目录仍然保留", sh: "test -f /srv/app/releases/2026-11-01/VERSION" },
  ],
  hints: [
    "ls -l /srv/app/current 和 readlink 看链接目标。",
    "ln -sfn /srv/app/releases/2026-11-22 /srv/app/current 原子切换。",
    "不要删旧版本，回滚还要用。",
  ],
};
