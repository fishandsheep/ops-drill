/**
 * A deliberately small course: every step is one command, and the kernel
 * checks the step's result (not just the text) before moving on.
 */
export const course = {
  title: "第一条 Linux 命令",
  subtitle: "7 步走完目录、文件与重定向",
  steps: [
    {
      title: "你在哪里？",
      task: "Linux 用当前工作目录来理解相对路径。先用 pwd（print working directory）看看自己站在哪。",
      command: "pwd",
      accept: ["pwd"],
      tip: "本次练习从 /root 开始。",
    },
    {
      title: "看看目录里有什么",
      task: "ls（list）列出当前目录的内容。现在目录基本是空的，这是正常的。",
      command: "ls",
      accept: ["ls", "ls -a", "ls -A", "ls -l", "ls -la", "ls -al"],
    },
    {
      title: "创建一个目录",
      task: "用 mkdir（make directory）建一个名为 lab 的目录，后面所有练习都放在里面。",
      command: "mkdir lab",
      accept: ["mkdir lab"],
      verify: { sh: "test -d /root/lab", label: "/root/lab 不存在" },
      failHint: "目录没有建在 /root 下。确认自己当前在 /root（pwd 看一下），再执行 mkdir lab。",
    },
    {
      title: "进入目录",
      task: "用 cd（change directory）进入刚才创建的 lab 目录。之后的命令都会在这里执行。",
      command: "cd lab",
      accept: ["cd lab", "cd ./lab", "cd /root/lab"],
      tip: "cd 是 shell 的内置命令，只改变当前终端的工作目录。",
    },
    {
      title: "新建一个空文件",
      task: "用 touch 创建一个空文件 notes.txt。touch 的本职是更新时间戳，但文件不存在时会顺手创建它。",
      command: "touch notes.txt",
      accept: ["touch notes.txt"],
      verify: { sh: "test -f /root/lab/notes.txt", label: "/root/lab/notes.txt 不存在" },
      failHint: "文件没出现在 /root/lab 里。先用 pwd 确认自己在 ~/lab，再执行 touch notes.txt。",
    },
    {
      title: "把文字写进文件",
      task: "用 echo 输出一行文字，再用 > 把它重定向到 notes.txt。> 会覆盖文件原有内容。",
      command: 'echo "hello linux" > notes.txt',
      accept: [
        'echo "hello linux" > notes.txt',
        "echo 'hello linux' > notes.txt",
        "echo hello linux > notes.txt",
      ],
      verify: {
        sh: "grep -qx 'hello linux' /root/lab/notes.txt",
        label: "notes.txt 的内容不是 hello linux",
      },
      failHint: "文件存在，但内容不对。注意 > 两边要有空格，文字要放在引号里。",
      tip: "引号让 shell 把 hello linux 当成一个参数。",
    },
    {
      title: "读回来确认",
      task: "用 cat 把文件内容打印到终端。看到 hello linux，这一课就完成了。",
      command: "cat notes.txt",
      accept: ["cat notes.txt"],
      verify: {
        sh: "grep -qx 'hello linux' /root/lab/notes.txt",
        label: "notes.txt 的内容不是 hello linux",
      },
    },
  ],
};
