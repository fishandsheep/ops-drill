export default {
  id: "stuck-lock",
  title: "上次发布留下的锁，卡住了整条流水线",
  service: "prod-worker-03",
  difficulty: "入门",
  tags: ["进程", "锁", "ps / kill"],
  cwd: "/srv/app",
  parSeconds: 150,
  briefing:
    "上一班同事的发布中断了，脚本进程还挂在那里，锁文件也留着。新的任务每次都判定“已有发布在进行”，直接退出。没人知道那个进程还在不在。",
  symptoms: [
    "/srv/app/data/.lock 存在",
    "新任务报 already running",
    "ps 里有一个 600 秒的 sleep",
  ],
  goal: "确认锁的主人确实卡住，结束它并清掉锁文件，让服务恢复。",
  setup: [
    "mkdir -p /srv/app/data /srv/app/bin",
    "sleep 600 & echo $! > /srv/app/data/.lock",
    "printf '#!/bin/sh\\nif [ -f /srv/app/data/.lock ] && kill -0 \"$(cat /srv/app/data/.lock)\" 2>/dev/null; then exit 1; fi\\necho running > /srv/app/data/state\\n' > /srv/app/bin/health.sh",
    "chmod +x /srv/app/bin/health.sh",
  ],
  checks: [
    { label: "health.sh 判定服务可用", sh: "/srv/app/bin/health.sh" },
    { label: "卡住的进程已经结束", sh: "! ps | grep '[s]leep 600'" },
    { label: "锁文件已经清理", sh: "test ! -f /srv/app/data/.lock" },
  ],
  hints: [
    "cat /srv/app/data/.lock 拿到 PID，ps 看它还在不在。",
    "kill <pid> 结束进程；不要直接 rm 锁文件糊过去。",
    "确认进程没了，再删锁文件。",
  ],
};
