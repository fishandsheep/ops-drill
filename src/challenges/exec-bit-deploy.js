export default {
  id: "exec-bit-deploy",
  title: "发布脚本没有执行权限",
  service: "prod-deploy-01",
  difficulty: "入门",
  tags: ["权限", "chmod", "find"],
  cwd: "/srv/app",
  parSeconds: 120,
  briefing:
    "CI 把构建产物打成 tar 包传到机器上，解包后所有脚本都丢了执行位。发布窗口只剩十分钟，deploy.sh 一执行就 Permission denied。",
  symptoms: [
    "/srv/app/bin/deploy.sh 权限是 644",
    "执行时报 Permission denied",
    "同目录下还有 rollback.sh 也缺执行位",
  ],
  goal: "让 bin 下所有 .sh 脚本恢复可执行，并让 deploy.sh 成功写出版本号。",
  setup: [
    "mkdir -p /srv/app/bin /srv/app/data",
    "printf '#!/bin/sh\\necho 2026.11.22 > /srv/app/data/version\\n' > /srv/app/bin/deploy.sh",
    "printf '#!/bin/sh\\nrm -f /srv/app/data/version\\n' > /srv/app/bin/rollback.sh",
    "chmod 644 /srv/app/bin/deploy.sh /srv/app/bin/rollback.sh",
    "printf '#!/bin/sh\\n/srv/app/bin/deploy.sh || exit 1\\ngrep -qx 2026.11.22 /srv/app/data/version\\n' > /srv/app/bin/health.sh",
    "chmod +x /srv/app/bin/health.sh",
  ],
  checks: [
    { label: "deploy.sh 能执行并写入版本号", sh: "/srv/app/bin/health.sh" },
    {
      label: "bin 下所有 .sh 都有执行位",
      sh: 'test -z "$(find /srv/app/bin -name \'*.sh\' ! -perm -u+x)"',
    },
  ],
  hints: [
    "ls -l /srv/app/bin 看每个文件的权限位。",
    "chmod +x /srv/app/bin/*.sh 一次修完。",
    "用 find -perm 检查有没有漏掉的脚本。",
  ],
};
