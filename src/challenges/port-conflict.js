export default {
  id: "port-conflict",
  title: "发布后 API 起不来，8080 被占用",
  service: "prod-api-04",
  difficulty: "入门",
  cwd: "/srv/app",
  tags: ["网络", "端口", "进程"],
  parSeconds: 180,
  briefing:
    "新版本发布到 prod-api-04 后，start-api.sh 立刻退出，日志里只有一行 address already in use。上一轮发布留下的 worker 没有随部署结束，仍然占着 8080；它还会被自己的循环不断拉起。负载均衡现在全部返回 502。",
  symptoms: [
    "启动 API 失败：bind 0.0.0.0:8080: address already in use",
    "netstat -lntp 显示 8080 处于 LISTEN，但进程不是新 API",
    "health 探测拿到的是 legacy 响应，不是 ok",
    "杀掉监听进程后端口很快又被占回去",
  ],
  goal: "停掉遗留 worker，释放 8080，让新 API 接管并通过健康检查。",
  setup: [
    "mkdir -p /srv/app/bin /srv/app/run /srv/app/logs",
    `cat > /srv/app/bin/legacy-worker.sh <<'SH'
#!/bin/sh
while true; do
  printf 'HTTP/1.0 200 OK\\r\\nContent-Length: 6\\r\\n\\r\\nlegacy' | nc -l -p 8080 >/dev/null 2>&1
  sleep 0.2
done
SH`,
    "chmod +x /srv/app/bin/legacy-worker.sh",
    `cat > /srv/app/bin/start-api.sh <<'SH'
#!/bin/sh
PORT=8080
if nc -z 127.0.0.1 "$PORT" 2>/dev/null; then
  echo "start-api: bind 0.0.0.0:$PORT: address already in use" >&2
  exit 1
fi
echo $$ > /srv/app/run/api.pid
child=
cleanup() {
  [ -n "$child" ] && kill "$child" 2>/dev/null
  exit 0
}
trap cleanup TERM INT
while true; do
  printf 'HTTP/1.0 200 OK\\r\\nContent-Length: 3\\r\\n\\r\\nok\\n' | nc -l -p "$PORT" >/dev/null 2>&1 &
  child=$!
  wait "$child"
  sleep 0.2
done
SH`,
    "chmod +x /srv/app/bin/start-api.sh",
    "nohup /srv/app/bin/legacy-worker.sh >/dev/null 2>&1 & echo $! > /srv/app/run/legacy.pid",
    "sleep 1",
    "/srv/app/bin/start-api.sh 2>/srv/app/logs/api.err || true",
  ],
  checks: [
    {
      label: "健康检查返回 ok",
      sh: "for i in 1 2 3 4 5; do wget -q -T 2 -O - http://127.0.0.1:8080/health 2>/dev/null | grep -qx ok && exit 0; sleep 0.3; done; exit 1",
    },
    {
      label: "新 API 进程仍在运行",
      sh: 'test -s /srv/app/run/api.pid && kill -0 "$(cat /srv/app/run/api.pid)" 2>/dev/null',
    },
    {
      label: "遗留 worker 已停止",
      sh: 'test ! -s /srv/app/run/legacy.pid || ! kill -0 "$(cat /srv/app/run/legacy.pid)" 2>/dev/null',
    },
  ],
  hints: [
    "netstat -lntp 或 fuser 8080/tcp 找到真正占端口的进程。",
    "占端口的不只是一个 nc：run/legacy.pid 指向的 worker 会不断把它拉起来。",
    "先停 worker，再释放端口，最后重新执行 bin/start-api.sh。",
  ],
};
