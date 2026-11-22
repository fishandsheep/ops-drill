import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import "./style.css";
import { checkSupport, createKernel } from "unkernel";
import kernelUrl from "unkernel/unkernel.wasm?url";
import {
  challenges,
  getChallenge,
  millisecondsLabel,
  todayChallenges,
} from "./challenges/index.js";
import { createLineTracker } from "./course-logic.js";
import {
  fetchScores,
  probeServer,
  saveName,
  savedName,
  startAttempt,
  submitScore,
} from "./leaderboard.js";

const view = document.getElementById("view");
const modalRoot = document.getElementById("modal-root");
const boardMode = document.getElementById("board-mode");

const challengeId = new URLSearchParams(location.search).get("c");
const challenge = challengeId ? getChallenge(challengeId) : null;

function setBoardMode(server, label) {
  boardMode.dataset.state = server ? "server" : "local";
  boardMode.innerHTML = "";
  const pip = document.createElement("span");
  pip.className = "pip";
  boardMode.append(pip, document.createTextNode(label));
}

function clock(ms, tenths = false) {
  const total = Math.max(0, ms) / 1000;
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  const base = `${m}:${String(s).padStart(2, "0")}`;
  return tenths ? `${base}.${Math.floor((total % 1) * 10)}` : base;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function renderScores(container, result, highlight) {
  container.replaceChildren();
  if (!result || result.scores.length === 0) {
    container.append(el("p", "empty", "还没有人完成。"));
    return;
  }
  const list = el("ol", "board");
  result.scores.slice(0, 10).forEach((entry, index) => {
    const row = el("li", entry.name === highlight ? "is-me" : "");
    row.append(el("span", "rank", String(index + 1).padStart(2, "0")));
    row.append(el("span", "who", entry.name));
    row.append(el("span", "time", millisecondsLabel(entry.ms)));
    list.append(row);
  });
  container.append(list);
}

/* ---------------------------------------------------------------- home --- */

function difficultyClass(difficulty) {
  if (difficulty === "困难") return "hard";
  if (difficulty === "进阶") return "medium";
  return "easy";
}

function challengeCard(item, compact = false) {
  const limit = compact ? 62 : 96;
  const brief =
    item.briefing.length > limit ? `${item.briefing.slice(0, limit)}…` : item.briefing;
  return `
    <article class="challenge-card${compact ? " is-compact" : ""}" data-difficulty="${item.difficulty}">
      <div class="cc-top">
        <span class="service"><span class="service-dot"></span>${item.service}</span>
        <span class="pill ${difficultyClass(item.difficulty)}">${item.difficulty}</span>
      </div>
      <h3><a href="?c=${item.id}">${item.title}</a></h3>
      <p class="cc-brief">${brief}</p>
      <ul class="tags">${item.tags.map((tag) => `<li>${tag}</li>`).join("")}</ul>
      <div class="cc-foot">
        <span>${item.checks.length} 项验收</span>
        <span>目标 ${clock(item.parSeconds * 1000)}</span>
        <a class="cc-link" href="?c=${item.id}">${compact ? "练习" : "进入现场"} →</a>
      </div>
    </article>`;
}

function renderHome() {
  const today = todayChallenges();
  const counts = challenges.reduce((acc, item) => {
    acc[item.difficulty] = (acc[item.difficulty] || 0) + 1;
    return acc;
  }, {});
  const filters = ["全部", "入门", "进阶", "困难"].filter(
    (name) => name === "全部" || counts[name]
  );

  view.innerHTML = `
    <div class="page">
      <section class="hero">
        <div class="hero-copy">
          <span class="eyebrow"><span class="eyebrow-dot"></span>LINUX INCIDENT LAB</span>
          <h1>把生产故障<br />练成肌肉记忆。</h1>
          <p>
            每天两道真实运维现场。不是选择题，是在一台真实 Linux 内核上把它修好：
            查日志、看进程、改配置，验收直接读文件系统。
          </p>
          <div class="hero-actions">
            <a class="btn btn-primary" href="?c=${today[0].id}">开始今日挑战</a>
            <a class="btn btn-ghost" href="#catalog">浏览题库</a>
          </div>
          <dl class="hero-stats">
            <div><dt>题库</dt><dd>${challenges.length} 道</dd></div>
            <div><dt>更新</dt><dd>每天 2 道</dd></div>
            <div><dt>环境</dt><dd>真实内核</dd></div>
            <div><dt>注册</dt><dd>不需要</dd></div>
          </dl>
        </div>
        <div class="hero-art" aria-hidden="true">
          <div class="term-card">
            <div class="term-bar">
              <span class="dots"><i></i><i></i><i></i></span>
              <span class="term-path">root@prod-api-03: /srv/app</span>
              <span class="term-badge">LIVE</span>
            </div>
            <div class="term-body">
              <p><span class="t-prompt">root@prod-api-03</span><span class="t-path">:~#</span> df -h /srv</p>
              <p class="t-out">Filesystem&nbsp; Size&nbsp; Used&nbsp; Avail&nbsp; Use%&nbsp; Mounted on</p>
              <p class="t-out">tmpfs&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 8.0M&nbsp; 8.0M&nbsp;&nbsp;&nbsp;&nbsp; 0&nbsp; 100%&nbsp; /srv/app/data</p>
              <p><span class="t-prompt">root@prod-api-03</span><span class="t-path">:~#</span> /srv/app/bin/health.sh</p>
              <p class="t-err">dd: /srv/app/data/.probe: No space left on device</p>
              <p><span class="t-prompt">root@prod-api-03</span><span class="t-path">:~#</span> <span class="t-cursor"></span></p>
            </div>
            <div class="term-foot">
              <span class="term-check fail"></span>
              <span>健康检查 <b>失败</b></span>
              <span class="term-time">00:42</span>
            </div>
          </div>
        </div>
      </section>

      <section class="section" id="today">
        <div class="section-head">
          <div>
            <span class="kicker">DAILY INCIDENTS</span>
            <h2>今日现场</h2>
          </div>
          <span class="section-note">每天 00:00 轮换 · 回车自动验收</span>
        </div>
        <div class="card-grid two">
          ${today.map((item) => challengeCard(item)).join("")}
        </div>
      </section>

      <div class="split-2">
        <section class="panel">
          <div class="panel-head">
            <h2>今日榜首</h2>
            <span id="daily-board-note"></span>
          </div>
          <div id="daily-board-body" class="panel-body">
            <p class="empty">读取中…</p>
          </div>
        </section>
        <section class="panel" id="rules">
          <div class="panel-head">
            <h2>怎么玩</h2>
            <span>4 步 / 3 分钟</span>
          </div>
          <ol class="steps">
            <li><span>01</span>选一个现场，内核在本地启动，故障自动布置。</li>
            <li><span>02</span>在终端排查修复，输入第一个字符开始计时。</li>
            <li><span>03</span>回车后自动验收，全部通过即结算。</li>
            <li><span>04</span>用时越短排名越高；刷新即重置现场。</li>
          </ol>
        </section>
      </div>

      <section class="section" id="catalog">
        <div class="section-head">
          <div>
            <span class="kicker">CHALLENGE LIBRARY</span>
            <h2>全部题目</h2>
          </div>
          <div class="filters" role="group" aria-label="按难度筛选">
            ${filters
              .map(
                (name, index) =>
                  `<button class="chip${index === 0 ? " is-on" : ""}" type="button" data-filter="${name}">${name}<span>${
                    name === "全部" ? challenges.length : counts[name]
                  }</span></button>`
              )
              .join("")}
          </div>
        </div>
        <div class="card-grid three" id="catalog-grid">
          ${challenges.map((item) => challengeCard(item, true)).join("")}
        </div>
        <p class="catalog-empty" id="catalog-empty" hidden>没有这个难度的题目。</p>
      </section>
    </div>
  `;

  const chips = view.querySelectorAll("[data-filter]");
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((node) => node.classList.toggle("is-on", node === chip));
      const filter = chip.dataset.filter;
      let visible = 0;
      view.querySelectorAll("#catalog-grid .challenge-card").forEach((card) => {
        const show = filter === "全部" || card.dataset.difficulty === filter;
        card.hidden = !show;
        if (show) visible += 1;
      });
      const empty = document.getElementById("catalog-empty");
      if (empty) empty.hidden = visible > 0;
    });
  });

  const first = today[0];
  if (first) loadHomeBoard(first);
}

async function loadHomeBoard(item) {
  const body = document.getElementById("daily-board-body");
  const note = document.getElementById("daily-board-note");
  if (!body) return;
  const result = await fetchScores(item.id);
  note.textContent = `${item.title} / ${result.total} 人 / ${
    result.mode === "server" ? "线上" : "本地"
  }`;
  renderScores(body, result, savedName());
  if (result.mode === "local") {
    body.append(
      el("p", "mode-note", "排行榜服务暂不可用，当前成绩只保存在本机。")
    );
  }
}

/* ------------------------------------------------------------- mission --- */

function renderMission(item) {
  const cwd = item.cwd || "/root";
  view.innerHTML = `
    <div class="page problem-page">
      <nav class="breadcrumb" aria-label="位置">
        <a href="./">题库</a><span>/</span><span>${item.id}</span>
      </nav>

      <header class="problem-head">
        <div class="problem-pills">
          <span class="pill ${difficultyClass(item.difficulty)}">${item.difficulty}</span>
          <span class="pill neutral">${item.service}</span>
          ${item.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
        </div>
        <h1>${item.title}</h1>
        <div class="problem-meta">
          <span><b>目标用时</b> ${clock(item.parSeconds * 1000)}</span>
          <span><b>工作目录</b> <code>${cwd}</code></span>
          <span><b>验收</b> ${item.checks.length} 项</span>
        </div>
      </header>

      <div class="problem-tabs" role="tablist" aria-label="题目导航">
        <button class="is-on" type="button" data-target="sec-brief">题目</button>
        <button type="button" data-target="sec-checks">验收</button>
        <button type="button" data-target="sec-board">排行榜</button>
        <button type="button" data-target="sec-hints">线索</button>
      </div>

      <div class="problem-grid">
        <div class="statement">
          <section class="stmt" id="sec-brief">
            <h2>事故简报</h2>
            <p>${item.briefing}</p>
            <h3>现场症状</h3>
            <ul class="symptoms">${item.symptoms.map((s) => `<li>${s}</li>`).join("")}</ul>
            <h3>恢复目标</h3>
            <p>${item.goal}</p>
          </section>

          <section class="stmt" id="sec-checks">
            <div class="stmt-head">
              <h2>验收条件</h2>
              <span id="check-count">0 / ${item.checks.length}</span>
            </div>
            <ul class="checks" id="checks">
              ${item.checks
                .map(
                  (check, index) =>
                    `<li data-state="pending" data-check="${index}"><span class="check-mark"></span><span class="check-label">${check.label}</span></li>`
                )
                .join("")}
            </ul>
            <p class="stmt-note">回车后自动检查，也可以点终端下方的“立即检查”。</p>
          </section>

          <section class="stmt" id="sec-board">
            <div class="stmt-head">
              <h2>本关最快</h2>
              <span id="board-total"></span>
            </div>
            <div id="mission-board" class="board-panel">
              <p class="empty">读取中…</p>
            </div>
          </section>

          <section class="stmt" id="sec-hints">
            <h2>线索</h2>
            <div class="hints">
              ${item.hints
                .map(
                  (hint, index) =>
                    `<details><summary>线索 ${index + 1}</summary><p>${hint}</p></details>`
                )
                .join("")}
            </div>
          </section>
        </div>

        <aside class="console-col">
          <section class="console" aria-label="Linux 终端">
            <div class="console-bar">
              <div class="console-id">
                <span class="console-pip" aria-hidden="true"></span>
                <span class="console-title">root@${item.service}:${cwd}</span>
              </div>
              <div class="console-right">
                <span class="console-timer" id="timer-box">
                  <span class="timer-label" id="timer-label">未开始</span>
                  <b id="timer">0:00.0</b>
                </span>
                <span class="console-state" id="conn">准备中</span>
              </div>
            </div>
            <div class="console-body">
              <div id="terminal"></div>
              <div class="boot-overlay" id="boot-overlay">
                <div class="boot-card">
                  <span class="boot-spinner" aria-hidden="true"></span>
                  <p class="boot-kicker">PROVISIONING</p>
                  <p class="boot-stage" id="boot-stage">检查浏览器能力…</p>
                  <p class="boot-error" id="boot-error" hidden></p>
                  <button class="btn btn-primary btn-sm" id="boot-retry" type="button" hidden>
                    重新加载
                  </button>
                </div>
              </div>
            </div>
            <div class="console-foot">
              <span class="console-hint" id="timer-sub">输入第一条命令开始计时</span>
              <div class="console-actions">
                <button class="btn btn-ghost btn-sm" id="reset" type="button">重置</button>
                <button class="btn btn-primary btn-sm" id="check-now" type="button" disabled>
                  立即检查
                </button>
              </div>
            </div>
          </section>
          <p class="console-tip">真实 Linux 内核在本机运行，命令不会影响你的电脑。</p>
        </aside>
      </div>
    </div>`;

  const ui = {
    checks: document.getElementById("checks"),
    checkNow: document.getElementById("check-now"),
    overlay: document.getElementById("boot-overlay"),
    stage: document.getElementById("boot-stage"),
    error: document.getElementById("boot-error"),
    retry: document.getElementById("boot-retry"),
  };

  const tabs = [...document.querySelectorAll(".problem-tabs button")];
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((node) => node.classList.toggle("is-on", node === tab));
      document
        .getElementById(tab.dataset.target)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  document.getElementById("reset").addEventListener("click", () => location.reload());
  ui.checkNow.addEventListener("click", () => void runChecks({ manual: true }));
  ui.retry.addEventListener("click", () => location.reload());

  void bootMission(item, ui);
}

/* --------------------------------------------------------------- state --- */

const session = {
  vm: null,
  term: null,
  tracker: null,
  ready: false,
  solved: false,
  startedAt: null,
  elapsed: null,
  timerId: null,
  attemptPromise: null,
  checking: false,
  rerun: false,
  autoTimer: null,
  checks: [],
};

function setConn(text, state = "waiting") {
  const node = document.getElementById("conn");
  if (!node) return;
  node.textContent = text;
  node.dataset.state = state;
}

function setCheckState(index, state) {
  const node = document.querySelector(`[data-check="${index}"]`);
  if (!node) return;
  node.dataset.state = state;
  const done = session.checks.filter(Boolean).length;
  const passed = session.checks.filter((value) => value === "pass").length;
  if (done === session.checks.length) {
    document.getElementById("check-count").textContent = `${passed} / ${session.checks.length}`;
  }
}

function updateTimerDisplay() {
  const timer = document.getElementById("timer");
  if (!timer) return;
  timer.textContent = session.startedAt ? clock(Date.now() - session.startedAt, true) : "0:00.0";
}

function beginTimer() {
  if (session.startedAt || !session.ready || session.solved) return;
  session.startedAt = Date.now();
  session.attemptPromise = startAttempt(challenge.id);
  const label = document.getElementById("timer-label");
  const sub = document.getElementById("timer-sub");
  if (label) label.textContent = "计时中";
  if (sub) sub.textContent = "验收全部通过后结算";
  document.getElementById("timer-box")?.classList.add("running");
  setConn("计时中", "live");
  session.timerId = setInterval(updateTimerDisplay, 100);
  updateTimerDisplay();
}

function looksLikeInput(data) {
  if (data.includes("\r") || data.includes("\n")) return true;
  for (let i = 0; i < data.length; i += 1) {
    const ch = data[i];
    if (ch === "\x1b") {
      const rest = data.slice(i);
      const match =
        /^\x1b\[[0-9;?]*[ -/]*[@-~]/.exec(rest) ||
        /^\x1bO[A-Za-z]/.exec(rest) ||
        /^\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/.exec(rest);
      if (match) {
        i += match[0].length - 1;
        continue;
      }
      continue;
    }
    if (ch >= " " && ch !== "\x7f") return true;
  }
  return false;
}

async function bootMission(item, ui) {
  const stage = (text) => {
    if (ui.stage) ui.stage.textContent = text;
  };

  try {
    stage("检查浏览器能力…");
    const support = await checkSupport();
    if (!support.ok) {
      throw new Error(
        `这个浏览器缺少运行 Linux 的能力：${support.problems.join("；")}。请使用 Chrome / Edge 137+、Firefox 153+ 或 Safari 27+。`
      );
    }

    session.term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      lineHeight: 1.25,
      scrollback: 5000,
      fontFamily:
        '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
      theme: {
        background: "#0d1117",
        foreground: "#c9d1d9",
        cursor: "#00ea64",
        cursorAccent: "#0d1117",
        selectionBackground: "#264f78",
        black: "#484f58",
        red: "#ff7b72",
        green: "#3fb950",
        yellow: "#d29922",
        blue: "#58a6ff",
        magenta: "#bc8cff",
        cyan: "#39c5cf",
        white: "#b1bac4",
        brightBlack: "#6e7681",
        brightRed: "#ffa198",
        brightGreen: "#56d364",
        brightYellow: "#e3b341",
        brightBlue: "#79c0ff",
        brightMagenta: "#d2a8ff",
        brightCyan: "#56d4dd",
        brightWhite: "#f0f6fc",
      },
    });
    session.term.open(document.getElementById("terminal"));
    session.term.focus();

    session.checks = item.checks.map(() => null);
    session.tracker = createLineTracker(({ command }) => {
      if (!command) return;
      clearTimeout(session.autoTimer);
      session.autoTimer = setTimeout(() => void runChecks({ manual: false }), 500);
    });

    session.term.onData((data) => {
      if (!session.ready) return;
      session.vm.write(data);
      if (!session.startedAt && looksLikeInput(data)) beginTimer();
      session.tracker.feed(data);
    });

    stage("加载内核…");
    session.vm = await createKernel({
      kernel: kernelUrl,
      onProgress: (p) => {
        const labels = {
          worker: "启动工作线程…",
          compile: "编译内核…",
          compiled: "内核编译完成",
          memory: "分配内存…",
          instantiate: "初始化内核…",
          start: "启动 Linux…",
          download: "下载内核…",
        };
        stage(labels[p.stage] || "启动中…");
      },
    });

    let shellReady = false;
    let admin = false;
    const markShell = () => {
      if (admin) return;
      admin = true;
      shellReady = true;
    };

    let decode = "";
    const decoder = new TextDecoder();
    session.vm.onOutput((bytes) => {
      session.term.write(bytes);
      decode += decoder.decode(bytes, { stream: true });
      if (decode.length > 4000) decode = decode.slice(-2000);
      if (!shellReady && /#\s*$/.test(decode.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, ""))) {
        setTimeout(markShell, 100);
      }
    });
    setTimeout(markShell, 5000);

    session.vm.exited
      .then(({ kind }) => {
        if (kind === "halt" || session.solved) return;
        throw new Error(`Linux 意外停止（${kind}）。`);
      })
      .catch((error) => failBoot(ui, error));

    await new Promise((resolve) => {
      const startedAt = Date.now();
      const poll = () => {
        if (shellReady || Date.now() - startedAt > 6000) resolve();
        else setTimeout(poll, 50);
      };
      poll();
    });

    for (const [index, command] of item.setup.entries()) {
      stage(`布置故障现场 ${index + 1} / ${item.setup.length}…`);
      const result = await session.vm.exec("sh", ["-c", command]);
      if (result.exitCode !== 0) {
        throw new Error(`场景初始化失败：\n${command}\n${result.stderr || ""}`);
      }
    }

    stage("运行初始验收…");
    for (const [index, check] of item.checks.entries()) {
      const result = await session.vm.exec("sh", ["-c", check.sh]);
      session.checks[index] = result.exitCode === 0 ? "pass" : "fail";
      setCheckState(index, session.checks[index]);
    }
    if (session.checks.every((state) => state === "pass")) {
      console.warn("all checks pass before the fix; scenario may be broken");
    }

    if (item.cwd) {
      session.vm.write(`cd ${item.cwd}\n`);
      const startedAt = Date.now();
      await new Promise((resolve) => {
        const poll = () => {
          if (decode.includes(item.cwd) || Date.now() - startedAt > 1500) resolve();
          else setTimeout(poll, 50);
        };
        poll();
      });
    }

    session.ready = true;
    session.term.write("\x1b[2J\x1b[H");
    session.term.writeln("\x1b[1;38;2;0;234;100mOPS/DRILL\x1b[0m  现场已就绪");
    session.term.writeln(`\x1b[2m${item.service} / ${item.title}\x1b[0m`);
    session.term.writeln(
      `\x1b[2m工作目录 ${item.cwd || "/root"}。输入第一个字符开始计时，回车后自动验收。\x1b[0m`
    );
    session.term.writeln("");
    session.vm.write("\n");

    ui.overlay.classList.add("is-hidden");
    setTimeout(() => {
      ui.overlay.hidden = true;
    }, 250);

    ui.checkNow.disabled = false;
    document.getElementById("timer-label").textContent = "未开始";
    setConn("等待首条命令", "waiting");
    session.term.focus();
    void loadMissionBoard(item);
  } catch (error) {
    failBoot(ui, error);
  }
}

function failBoot(ui, error) {
  if (!ui?.overlay) return;
  ui.overlay.hidden = false;
  ui.overlay.classList.remove("is-hidden");
  ui.stage.hidden = true;
  ui.error.hidden = false;
  ui.error.textContent = error?.message || String(error);
  ui.retry.hidden = false;
  setConn("启动失败", "error");
}

async function runChecks({ manual }) {
  if (!session.ready || session.solved || !session.vm) return;
  if (session.checking) {
    session.rerun = true;
    return;
  }
  session.checking = true;
  const checkButton = document.getElementById("check-now");
  if (checkButton) checkButton.disabled = true;
  if (manual) {
    session.checks = challenge.checks.map(() => null);
    challenge.checks.forEach((_, index) => setCheckState(index, "running"));
  }

  let allPassed = true;
  for (const [index, check] of challenge.checks.entries()) {
    if (!manual) setCheckState(index, "running");
    let state = "fail";
    try {
      const result = await session.vm.exec("sh", ["-c", check.sh]);
      state = result.exitCode === 0 ? "pass" : "fail";
    } catch {
      state = "fail";
    }
    session.checks[index] = state;
    setCheckState(index, state);
    if (state === "fail") allPassed = false;
  }

  session.checking = false;
  if (checkButton) checkButton.disabled = false;
  if (allPassed) {
    solve();
  } else if (manual) {
    setConn("仍有验收未通过", "waiting");
    document.querySelector('[data-state="fail"]')?.classList.add("attention");
    setTimeout(
      () => document.querySelectorAll(".attention").forEach((node) => node.classList.remove("attention")),
      900
    );
  }
  if (session.rerun) {
    session.rerun = false;
    if (!session.solved) void runChecks({ manual: false });
  }
}

async function solve() {
  if (session.solved) return;
  session.solved = true;
  session.elapsed = session.startedAt ? Date.now() - session.startedAt : 0;
  clearInterval(session.timerId);
  clearTimeout(session.autoTimer);

  const timer = document.getElementById("timer");
  if (timer) timer.textContent = clock(session.elapsed, true);
  const label = document.getElementById("timer-label");
  if (label) label.textContent = "已恢复";
  const sub = document.getElementById("timer-sub");
  if (sub) sub.textContent = "验收全部通过，成绩待提交";
  document.getElementById("timer-box")?.classList.add("solved");
  setConn("现场已恢复", "solved");
  document.getElementById("check-now").disabled = true;
  showSolvedModal();

  void loadMissionBoard(challenge);
}

/* --------------------------------------------------------------- modal --- */

function showSolvedModal() {
  const item = challenge;
  const ms = session.elapsed;
  modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="solved-title">
        <div class="modal-head">
          <span class="success-mark" aria-hidden="true">✓</span>
          <div>
            <p class="modal-kicker">INCIDENT CLOSED / ${item.service}</p>
            <h2 id="solved-title">现场已恢复</h2>
          </div>
        </div>
        <dl class="result-facts">
          <div><dt>用时</dt><dd>${clock(ms, true)}</dd></div>
          <div><dt>验收</dt><dd>${item.checks.length} / ${item.checks.length}</dd></div>
          <div><dt>难度</dt><dd>${item.difficulty}</dd></div>
        </dl>
        <form id="score-form" autocomplete="off">
          <label for="score-name">署名，写入排行榜</label>
          <div class="score-row">
            <input id="score-name" maxlength="16" required placeholder="昵称，最多 16 字" />
            <button class="btn btn-primary" type="submit">提交</button>
          </div>
        </form>
        <div id="score-result"></div>
        <button class="btn btn-ghost" id="modal-close" type="button">关闭，继续看终端</button>
      </div>
    </div>`;

  document.getElementById("modal-close").addEventListener("click", () => {
    modalRoot.replaceChildren();
  });

  const form = document.getElementById("score-form");
  const input = document.getElementById("score-name");
  input.value = savedName();
  input.focus();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = input.value.trim().slice(0, 16);
    if (!name) return;
    const button = form.querySelector("button");
    button.disabled = true;
    button.textContent = "提交中…";
    saveName(name);

    const attempt = await (session.attemptPromise ?? startAttempt(item.id));
    const elapsed = session.elapsed;
    const result = await submitScore({
      challengeId: item.id,
      token: attempt.token,
      name,
      ms: elapsed,
    });

    const box = document.getElementById("score-result");
    box.replaceChildren();
    box.append(
      el(
        "p",
        "score-line",
        `第 ${result.rank} 名 / ${result.total} 人 / 用时 ${millisecondsLabel(result.elapsed ?? elapsed)}`
      )
    );
    const board = el("div", "modal-board");
    renderScores(board, result, name);
    box.append(board);
    if (result.mode === "local") {
      box.append(el("p", "mode-note", "排行榜服务暂不可用，成绩已存到本机。"));
    } else if (result.improved === false) {
      box.append(el("p", "mode-note", "这是你的历史成绩，本次没有更快。"));
    }
    updateMissionBoard(result, name);
    button.textContent = "已提交";
    input.disabled = true;
  });
}

function updateMissionBoard(result, name) {
  const container = document.getElementById("mission-board");
  const total = document.getElementById("board-total");
  if (!container) return;
  renderScores(container, result, name);
  if (total) total.textContent = `${result.total} 人完成`;
}

async function loadMissionBoard(item) {
  const container = document.getElementById("mission-board");
  if (!container) return;
  const result = await fetchScores(item.id);
  updateMissionBoard(result, savedName());
  if (result.mode === "local") {
    container.append(
      el("p", "mode-note", "排行榜服务暂不可用，仅显示本机成绩。")
    );
  }
}

/* ----------------------------------------------------------------- run --- */

document.title = challenge
  ? `${challenge.title} / OPS/DRILL`
  : "OPS/DRILL / 真实 Linux 生产故障靶场";

setBoardMode(false, "检测排行榜");
probeServer().then((ok) => {
  setBoardMode(ok, ok ? "线上榜" : "本地榜");
});

if (!challenge) {
  renderHome();
} else {
  renderMission(challenge);
}

if (import.meta.env.DEV) {
  window.__drill = { session, challenge, runChecks, solve, beginTimer, renderScores };
}
