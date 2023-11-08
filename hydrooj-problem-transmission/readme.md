## Hydro 题目传输工具

HydroOJ 前端传输题目时常常会出现文件过大网络中断等问题，使用该工具可以较好地规避此问题。

使用前，在该文件夹下建立 `secret.json` 文件：

```json
{
    "oj_url": "https://hydro.ac",
    "cookie_sid": "<cookie>",
    "domain": "<domain>",
    "download": [
        "<pid>"
    ],
    "upload": [
        {
            "pid": "<pid>",
            "path": "<path>"
        }
    ]
}
```

其中 `cookie_sid` 表示你的 Cookie 中的 sid 项；

`domain` 表示域 ID，系统域为 `system`；

`download` 传入一个数组，每项表示一个下载任务的题号；

`upload` 传入一个数组，每项表示一个上传任务，包含四个值：

- `pid` 表示目标题目 ID，可以是数字编号，也可以是字符串编号，但传入时统一用引号包裹；
- `path` 表示本地题目文件夹，压缩包请自行解压，例如 `data/system/P1001`。

使用如下指令启动程序（请务必保证配置正确）：

```shell
npm i
npx ts-node index.ts
```

注意：本工具没有很好地检测输入内容或文件是否合法，请自行检查。