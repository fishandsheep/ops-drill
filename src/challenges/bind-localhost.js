export default {
  id: "bind-localhost",
  title: "本机健康，负载均衡却连不上",
  service: "prod-api-05",
  difficulty: "进阶",
  cwd: "/srv/app",
  tags: ["网络", "监听地址", "负载均衡"],
  parSeconds: 240,
  briefing:
    "prod-api-05 的本地健康检查一直是 200，但上游负载均衡通过节点地址 10.0.0.5 探测时全部超时，节点被摘除。昨天有人为了排查安全组，把 API 的监听地址临时改成了 127.0.0.1，之后忘了改回来。",
  symptoms: [
    "wget http://127.0.0.1:8080/health 返回 ok",
    "从 10.0.0.5 连接 8080 被拒绝",
    "netstat -lnt 只看到 127.0.0.1:8080，没有 0.0.0.0:8080",
    "节点在负载均衡里持续 unhealthy",
  ],
  goal: "让 API 监听所有网卡，使 10.0.0.5:8080 可访问，同时保留本机健康检查。",
  setup: [
    "mkdir -p /srv/app/bin /srv/app/etc /srv/app/run",
    "ip link set dummy0 up 2>/dev/null || true",
    "ip addr add 10.0.0.5/24 dev dummy0 2>/dev/null || true",
    `cat > /srv/app/etc/api.conf <<'SH'
# 负载均衡通过节点地址 10.0.0.5 访问
BIND=127.0.0.1
PORT=8080
SH`,
    `cat > /srv/app/bin/api.sh <<'SH'
#!/bin/sh
. /srv/app/etc/api.conf
echo $$ > /srv/app/run/api.pid
child=
cleanup() {
  [ -n "$child" ] && kill "$child" 2>/dev/null
  exit 0
}
trap cleanup TERM INT
while true; do
  printf 'HTTP/1.0 200 OK\\r\\nContent-Length: 3\\r\\n\\r\\nok\\n' | nc -l -s "$BIND" -p "$PORT" >/dev/null 2>&1 &
  child=$!
  wait "$child"
  sleep 0.2
done
SH`,
    "chmod +x /srv/app/bin/api.sh",
    "nohup /srv/app/bin/api.sh >/dev/null 2>&1 &",
    "sleep 1",
  ],
  checks: [
    {
      label: "本机健康检查返回 ok",
      sh: "for i in 1 2 3 4 5; do wget -q -T 2 -O - http://127.0.0.1:8080/health 2>/dev/null | grep -qx ok && exit 0; sleep 0.3; done; exit 1",
    },
    {
      label: "节点地址 10.0.0.5:8080 可连接",
      sh: "for i in 1 2 3 4 5; do nc -z -w 1 10.0.0.5 8080 && exit 0; sleep 0.3; done; exit 1",
    },
  ],
  hints: [
    "netstat -lnt 看 Local Address：127.0.0.1 和 0.0.0.0 的区别就是这次故障的范围。",
    "监听地址来自 /srv/app/etc/api.conf 的 BIND。",
    "改完配置要重启进程才会重新 bind：kill $(cat run/api.pid)，再执行 bin/api.sh。",
  ],
};
