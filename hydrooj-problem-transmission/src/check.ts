import { readFileSync } from 'node:fs'
import { ensureDirSync } from 'fs-extra'
import HydroAccountService from './basic/service'
import { SecretConfig } from './basic/secret'
import { Queue } from './queue'

const presetCheckers = [
    'acmp', 'caseicmp', 'casencmp', 'casewcmp', 'dcmp', 'fcmp', 'hcmp',
    'icmp', 'lcmp', 'ncmp', 'nyesno', 'pointscmp', 'pointsinfo',
    'rcmp', 'rcmp4', 'rcmp6', 'rcmp9', 'rncmp', 'uncmp', 'wcmp', 'yesno',
]

interface SubtaskConfig {
    id: number
    if: number[]
    score: number
    type: 'sum' | 'min' | 'max'
    cases: {
        input: string
        output: string
    }[]
}

interface JudgeConfig {
    type: 'default'
    time?: string
    memory?: string
    checker?: string
    user_extra_files?: string[]
    subtasks: SubtaskConfig[]
}

const ALLOW_EXTRA_TESTDATA = [
    ...['py', 'sh', 'cc', 'cpp', 'js', 'mjs', 'ts'].map((ext: string) => `generator.${ext}`)
]

console.log({
    SecretConfigFile: process.argv[2] || 'secret.json',
})

const secret = JSON.parse(readFileSync(process.argv[3] || 'secret.json').toString()) as SecretConfig

const service = new HydroAccountService(
    secret.oj_url,
    secret.cookie_sid ? `sid=${secret.cookie_sid}` : '',
    secret.domain,
)

const queue = new Queue(5)

let totalError = 0

interface ProblemData {
    englishName: string
    additional_file: string[]
    testdata: string[]
    maxSampleId: number
    sampleInputId: number[]
    sampleOutputId: number[]
    additional_file_assertions: Record<string, string>
}

const data: Record<string, ProblemData> = {}

function convert(content: string): string {
    return content.replace(/\r/g, '').trim()
        .split('\n').map(x => x.trim()).join('\n')
}

function throwError(pid: string, content: string) {
    totalError++
    console.error(`Error: ${pid}: ${content}`)
}

function checkStatement(content: string, pid: string) {
    content = convert(content)
    const blocks = content
        .split('\n\n')
        .map(block => block.trim())
        .filter(block => block.length > 0)
    for (let block of blocks) {
        if (block.startsWith('#')) {
            if (!(
                /^## 外部库说明$/.test(block) ||
                /^## 输入格式$/.test(block) ||
                /^## 输出格式$/.test(block) ||
                /^## 样例 [1-9][0-9]*$/.test(block) ||
                /^## 样例 [1-9][0-9]*? 解释$/.test(block) ||
                /^## 数据范围$/.test(block) ||
                /^## 评分方式$/.test(block) ||
                /^## 数据范围与评分方式$/.test(block) ||
                /^## 子任务$/.test(block)
            )) throwError(pid, `"${block}" is not a valid title`)
            continue
        }
        if (block.startsWith('```')) {
            if (!block.startsWith('```') || !block.endsWith('```'))
                throwError(pid, `"${block}" is not a valid code block`)
            else {
                const lang = block.split('\n')[0].split('|')[0].replace('```', '')
                const content = convert(block.slice(block.split('\n')[0].length + 1, -4))
                if (/^input\d+$/.test(lang)) {
                    const id = lang.replace('input', '')
                    data[pid].sampleInputId.push(+id)
                    data[pid].additional_file.push(`${data[pid].englishName}${id}.in`)
                    data[pid].maxSampleId = Math.max(data[pid].maxSampleId, +id)
                    data[pid].additional_file_assertions[`${data[pid].englishName}${id}.in`] = content
                }
                if (/^output\d+$/.test(lang)) {
                    const id = lang.replace('output', '')
                    data[pid].sampleOutputId.push(+id)
                    data[pid].additional_file.push(`${data[pid].englishName}${id}.ans`)
                    data[pid].maxSampleId = Math.max(data[pid].maxSampleId, +id)
                    data[pid].additional_file_assertions[`${data[pid].englishName}${id}.ans`] = content
                }
            }
            continue
        }
        if (/^见选手目录/.test(block)) {
            const message = `"${block}" is not a valid big sample description`
            if (!/^见选手目录下的 \[`.+?`\]\(file:\/\/.+?\) 和 \[`.+?`\]\(file:\/\/.+?\)。$/.test(block))
                throwError(pid, message)
            else {
                const result = /^见选手目录下的 \[`(.+?)`\]\(file:\/\/(.+?)\) 和 \[`(.+?)`\]\(file:\/\/(.+?)\)。$/.exec(block) as string[]
                const folder = `${data[pid].englishName}/${data[pid].englishName}`
                if (!result[1].startsWith(folder) || !result[1].endsWith('.in')) {
                    throwError(pid, message)
                    continue
                }
                const id = result[1].substring(folder.length, result[1].length - 3)
                if (
                    !/^[1-9][0-9]*$/.test(id) ||
                    result[1] !== `${folder}${id}.in` ||
                    result[2] !== `${data[pid].englishName}${id}.in` ||
                    result[3] !== `${folder}${id}.ans` ||
                    result[4] !== `${data[pid].englishName}${id}.ans`
                ) throwError(pid, message)
                else {
                    data[pid].maxSampleId = Math.max(data[pid].maxSampleId, +id)
                    data[pid].sampleInputId.push(+id)
                    data[pid].sampleOutputId.push(+id)
                    data[pid].additional_file.push(`${data[pid].englishName}${id}.in`)
                    data[pid].additional_file.push(`${data[pid].englishName}${id}.ans`)
                }
            }
            continue
        }
        const AdditionalFileMatcher = /\[.*?\]\(file\:\/\/(.+?)( .+?)?\)/g
        let file
        while (file = AdditionalFileMatcher.exec(block))
            data[pid].additional_file.push(file[1])
    }
    let flag = false
    for (let sampleId = 1; sampleId <= data[pid].maxSampleId; sampleId++) {
        if (data[pid].sampleInputId[sampleId - 1] !== sampleId) flag = true
        if (data[pid].sampleOutputId[sampleId - 1] !== sampleId) flag = true
    }
    if (flag) throwError(pid, `Unknown error in samples.`)
    let command
    const CommandMatcher = /<!-- PROBLEM_FORMAT_CHECKER: (.+?) -->/g
    while (command = CommandMatcher.exec(content)) {
        if (command[1].startsWith('extra_additional_file: '))
            data[pid].additional_file.push(command[1].replace('extra_additional_file: ', ''))
    }
}

function checkJudgeConfig(config: JudgeConfig, pid: string) {
    for (let subtask of config.subtasks) {
        for (let testcase of subtask.cases) {
            if (testcase.input !== '/dev/null') {
                data[pid].testdata.push(testcase.input)
                if (!/^[a-z]*?[\d\-]+?\.in$/.test(testcase.input) || !testcase.input.startsWith(data[pid].englishName))
                    throwError(pid, `Input file "${testcase.input}" is not a valid name.`)
            }
            if (testcase.output !== '/dev/null') {
                data[pid].testdata.push(testcase.output)
                if (!/^[a-z]*?[\d\-]+?\.ans$/.test(testcase.output) || !testcase.output.startsWith(data[pid].englishName))
                    throwError(pid, `Output file "${testcase.output}" is not a valid name.`)
            }
        }
    }
    for (let file of config.user_extra_files || [])
        data[pid].testdata.push(file)
    if (config.checker && !presetCheckers.includes(config.checker)) {
        if (config.checker !== 'checker.cc')
            throwError(pid, `Checker file must be 'checker.cc'.`)
        data[pid].testdata.push(config.checker)
    }
}

async function main() {
    if (!secret.cookie_sid) await service.login(
        secret.username as string,
        secret.password as string,
    )
    const username = await service.getLoggedInUser()
    if (username === 'Guest') {
        console.error(`Not logged in`)
        throw new Error(`Not logged in.`)
    }
    console.log(`Logged in as user ${username}`)
    ensureDirSync('data/tmp')
    const pids = await service.listProblems()
    await Promise.all(pids.map((pid) => queue.waitForTask(async () => {
        if (pids.filter((id) => pid < id).length > 10) {
            if (Math.random() < 0.8) {
                console.info(`Skipped problem ${pid}`)
                return
            }
        }
        await new Promise((resolve) => setTimeout(resolve, 5000) as any)
        data[pid] = {
            englishName: '',
            maxSampleId: 0,
            testdata: ['config.yaml'],
            additional_file: [],
            sampleInputId: [],
            sampleOutputId: [],
            additional_file_assertions: {},
        }
        const title = await service.getProblemTitle(pid)
        if (!/^.+?（[a-z]+?）$/.test(title)) {
            throwError(pid, `"${title}" is not a valid problem title`)
            return
        }
        data[pid].englishName = title.split('（')[1].split('）')[0]
        console.log(`Checking problem ${pid} (${data[pid].englishName})`)
        console.log(`Checking statement`)
        const statement = await service.getProblemStatement(pid)
        for (let [, content] of Object.entries(statement))
            checkStatement(content as string, pid)
        const files = await service.getFiles(pid)
        if (!files.testdata.includes('config.yaml')) {
            throwError(pid, 'No judge config file found.')
            return
        }
        console.log(`Checking judge config`)
        const config = await service.getJudgeConfig(pid)
        checkJudgeConfig(config, pid)
        for (let file of data[pid].testdata)
            if (!files.testdata.includes(file))
                throwError(pid, `File "${file}" can not found in testdata.`)
        for (let file of data[pid].additional_file)
            if (!files.additional_file.includes(file))
                throwError(pid, `File "${file}" can not found in additional file.`)
        for (let file of files.testdata)
            if (!data[pid].testdata.includes(file) && !ALLOW_EXTRA_TESTDATA.includes(file))
                throwError(pid, `Testdata "${file}" is not required.`)
        for (let file of files.additional_file)
            if (!data[pid].additional_file.includes(file))
                throwError(pid, `Additional file "${file}" is not required.`)
        for (let [filename, content] of Object.entries(data[pid].additional_file_assertions)) {
            if (!files.additional_file.includes(filename)) continue
            const fileId = `${Math.random()}`
            await service.downloadFile((await service.getLinks(pid, [filename], 'additional_file'))[filename], `tmp/${fileId}`)
            if (content !== convert(readFileSync(`data/tmp/${fileId}`).toString()))
                throwError(pid, `Sample file ${filename} is not same as the sample in statement.`)
        }
    })))
    queue.close()
    if (totalError > 0) throw new Error(`Found ${totalError} errors.`)
}

main()
