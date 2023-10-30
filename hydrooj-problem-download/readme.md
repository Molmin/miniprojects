## Hydro 题目下载器

HydroOJ 前端导出时常常会出现文件过大网络中断等问题，使用该下载器可以较好地规避此问题。

使用前，在该文件夹下建立 `secret.json` 文件：

```json
{
    "oj_url": "https://hydro.ac",
    "cookie_sid": "<cookie>",
    "domain": "<domain>",
    "problem": [
        {
            "pid": "<pid>",
            "additional_file": true,
            "testdata": true,
            "statement": true
        }
    ]
}
```

其中 `cookie_sid` 表示你的 Cookie 中的 sid 项；

`domain` 表示域 ID，系统域为 `system`；

`problem` 传入一个数组，每项包含四个值：

- `pid` 表示题目 ID，可以是数字编号，也可以是字符串编号，但传入时统一用引号包裹；
- 剩余三项分别表示是否下载附加文件、测试数据、题面及配置，一般用于更新数据的三者之一时使用。

使用如下指令启动程序（请务必保证配置正确）：

```shell
npm i
npx ts-node index.ts
```