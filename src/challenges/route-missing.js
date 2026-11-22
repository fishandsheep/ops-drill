export default {
  id: "route-missing",
  title: "管理网段失联，监控采不到数",
  service: "prod-node-07",
  difficulty: "进阶",
  cwd: "/srv/app",
  tags: ["网络", "路由", "ip route"],
  parSeconds: 240,
  briefing:
    "prod-node-07 刚做完网卡调整，业务端口都正常，但监控代理上报全部超时。节点地址 10.0.0.5 还在，管理网段 10.0.0.0/24 的直连路由却在重配时被删掉了，到 10.0.0.10 的流量现在直接返回 Network is unreachable。",
  symptoms: [
    "ip route get 10.0.0.10 报 Network is unreachable",
    "ip addr 显示 10.0.0.5/24 仍在 dummy0 上",
    "ping 10.0.0.10 直接失败，没有发出请求",
    "bin/mgmt-check.sh 退出码为 1",
  ],
  goal: "恢复 10.0.0.0/24 的直连路由，让节点重新到达管理网段。",
  setup: [
    "ip link set dummy0 up 2>/dev/null || true",
    "ip addr add 10.0.0.5/24 dev dummy0 2>/dev/null || true",
    "ip route del 10.0.0.0/24 dev dummy0 2>/dev/null || true",
    "mkdir -p /srv/app/bin",
    `cat > /srv/app/bin/mgmt-check.sh <<'SH'
#!/bin/sh
ip route get 10.0.0.10 >/dev/null 2>&1 || { echo "no route to 10.0.0.10" >&2; exit 1; }
echo "management route ok"
SH`,
    "chmod +x /srv/app/bin/mgmt-check.sh",
  ],
  checks: [
    {
      label: "到 10.0.0.10 的路由存在",
      sh: "/srv/app/bin/mgmt-check.sh",
    },
    {
      label: "流量从 dummy0 发出",
      sh: "ip route get 10.0.0.10 | grep -q 'dev dummy0'",
    },
  ],
  hints: [
    "ip route 看当前路由表，ip route get 10.0.0.10 看内核会怎么走。",
    "地址还在，缺的是 10.0.0.0/24 这条直连路由。",
    "ip route add 10.0.0.0/24 dev dummy0 可以补回来。",
  ],
};
