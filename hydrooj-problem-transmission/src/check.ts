import { readFileSync } from 'node:fs'
import HydroAccountService from './basic/service'
import { SecretConfig } from './basic/secret'

console.log({
    SecretConfigFile: process.argv[2] || 'secret.json',
})

const secret = JSON.parse(readFileSync(process.argv[3] || 'secret.json').toString()) as SecretConfig

const service = new HydroAccountService(
    secret.oj_url,
    `sid=${secret.cookie_sid}`,
    secret.domain,
)

let totalError = 0
let nowpid: string = '', englishName: string = ''

function throwError(content: string) {
    totalError++
    console.log(`${nowpid}: ${content}`)
}

function checkStatement(content: string) {
    content = content.replace(/\r/g, '').trim()
    const blocks = content
        .split('\n\n')
        .map(block => block.trim())
        .filter(block => block.length > 0)
    for (let block of blocks) {
        if (block.startsWith('#')) {
            if (!(
                /^## 输入格式$/.test(block) ||
                /^## 输出格式$/.test(block) ||
                /^## 样例 [1-9][0-9]*$/.test(block) ||
                /^## 样例 [1-9][0-9]*? 解释$/.test(block) ||
                /^## 数据范围$/.test(block) ||
                /^## 数据范围与评分方式$/.test(block) ||
                /^## 子任务$/.test(block)
            )) throwError(`"${block}" is not a valid title`)
            continue
        }
        if (block.startsWith('```')) {
            if (!block.startsWith('```') || !block.endsWith('```'))
                throwError(`"${block}" is not a valid code block`)
            continue
        }
        if (/^见/.test(block)) {
            if (!/^见选手目录下的 \[`.+?`\]\(file:\/\/.+?\) 和 \[`.+?`\]\(file:\/\/.+?\)。$/.test(block))
                throwError(`"${block}" is not a valid big sample description`)
            else {
                console.log(block)
            }
            continue
        }
    }
}

async function main() {
    const username = await service.getLoggedInUser()
    if (username === 'Guest') return console.error(`Not logged in`)
    console.log(`Logged in as user ${username}`)
    const pids = await service.listProblems()
    for (let pid of pids) {
        nowpid = pid
        const title = await service.getProblemTitle(pid)
        if (!/^.+?（[a-z]+?）$/.test(title)) {
            throwError(`"${title}" is not a valid problem title`)
            continue
        }
        englishName = title.split('（')[1].split('）')[0]
        console.log(`Checking problem ${pid} (${englishName})`)
        console.log(`Checking statement`)
        const statement = await service.getProblemStatement(pid)
        for (let [, content] of Object.entries(statement))
            checkStatement(content as string)
    }
    if (totalError > 0) throw new Error(`Found ${totalError} errors.`)
}

main()