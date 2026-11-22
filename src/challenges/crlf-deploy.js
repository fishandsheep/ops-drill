export default {
  id: "crlf-deploy",
  title: "脚本在 Windows 上改过，Linux 跑不起来",
  service: "prod-deploy-02",
  difficulty: "入门",
  tags: ["换行符", "脚本", "sed"],
  cwd: "/srv/app",
  parSeconds: 150,
  briefing:
    "发布脚本上周被同事在 Windows 上编辑过。现在一执行就报 not found，但文件明明存在、权限也对。问题不在权限，在 CRLF 换行。",
  symptoms: [
    "/srv/app/bin/deploy.sh 存在且可执行",
    "执行报 not found",
    "版本文件没有生成",
  ],
  goal: "修掉脚本里的 CRLF，让 deploy.sh 正常执行并写入版本号。",
  setup: [
    "mkdir -p /srv/app/bin /srv/app/data",
    "printf '#!/bin/sh\\r\\necho 2026.11.22 > /srv/app/data/version\\r\\n' > /srv/app/bin/deploy.sh",
    "chmod +x /srv/app/bin/deploy.sh",
    "printf '#!/bin/sh\\n/srv/app/bin/deploy.sh || exit 1\\ngrep -qx 2026.11.22 /srv/app/data/version\\n' > /srv/app/bin/health.sh",
    "chmod +x /srv/app/bin/health.sh",
  ],
  checks: [
    { label: "deploy.sh 能写出正确版本号", sh: "/srv/app/bin/health.sh" },
    {
      label: "脚本中不再有 CR",
      sh: '[ "$(tr -d "\\r" < /srv/app/bin/deploy.sh | wc -c)" = "$(wc -c < /srv/app/bin/deploy.sh)" ]',
    },
  ],
  hints: [
    "xxd /srv/app/bin/deploy.sh 看行尾是不是 0d 0a。",
    "sed -i 's/\\r$//' 可以去掉行尾的 CR。",
    "改完确认文件仍然可执行。",
  ],
};
