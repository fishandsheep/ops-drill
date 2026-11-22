export default {
  id: "perm-app-data",
  title: "热修之后，应用写盘全部被拒",
  service: "prod-worker-07",
  difficulty: "入门",
  cwd: "/srv/app",
  tags: ["权限", "用户", "chown"],
  parSeconds: 120,
  briefing:
    "一次手工热修把数据目录重新挂载成了 root 所有。应用以 app 用户运行，能启动，但每个需要落盘的请求都返回 500。值班同事说“改一下权限就好了”，但 777 不是答案。",
  symptoms: [
    "ls -ld /srv/app/data 显示 root:root 750",
    "su app -c 'touch /srv/app/data/x' 被拒绝",
    "服务日志里全是 Permission denied",
  ],
  goal: "让 app 用户能写入 /srv/app/data，同时不要把目录对所有人开放。",
  setup: [
    "adduser -D -H app",
    "mkdir -p /srv/app/data /srv/app/bin",
    "printf 'running=1\\n' > /srv/app/data/state",
    "chown -R root:root /srv/app",
    "chmod 750 /srv/app/data",
    "printf '#!/bin/sh\\nsu app -c \"echo ok > /srv/app/data/.health\" || exit 1\\nrm -f /srv/app/data/.health\\n' > /srv/app/bin/health.sh",
    "chmod +x /srv/app/bin/health.sh",
  ],
  checks: [
    {
      label: "app 用户能写入数据目录",
      sh: "/srv/app/bin/health.sh",
    },
    {
      label: "目录没有对所有人开放",
      sh: 'case $(stat -c %a /srv/app/data) in *7) exit 1 ;; esac',
    },
  ],
  hints: [
    "id 和 ls -ld /srv/app/data 确认两边分别是哪个用户。",
    "chown -R app:app /srv/app/data 把所有权还给运行应用的用户。",
    "保留 750 或 770，不要用 chmod 777 把门拆了。",
  ],
};
