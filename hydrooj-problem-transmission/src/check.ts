import { readFileSync } from 'node:fs'
import { ensureDirSync } from 'fs-extra'
import HydroAccountService from './basic/service'
import { SecretConfig } from './basic/secret'

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

let totalError = 0
let nowpid: string = '', englishName: string = ''
let additional_file: string[] = []
let testdata: string[] = []
let maxSampleId = 0
let sampleInputId: number[] = [], sampleOutputId: number[] = []

function throwError(content: string) {
    totalError++
    console.error(`Error: ${nowpid}: ${content}`)
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
                /^## 评分方式$/.test(block) ||
                /^## 数据范围与评分方式$/.test(block) ||
                /^## 子任务$/.test(block)
            )) throwError(`"${block}" is not a valid title`)
            continue
        }
        if (block.startsWith('```')) {
            if (!block.startsWith('```') || !block.endsWith('```'))
                throwError(`"${block}" is not a valid code block`)
            else {
                const lang = block.split('\n')[0].split('|')[0].replace('```', '')
                if (/^input\d+$/.test(lang)) {
                    const id = lang.replace('input', '')
                    sampleInputId.push(+id)
                    additional_file.push(`${englishName}${id}.in`)
                    maxSampleId = Math.max(maxSampleId, +id)
                }
                if (/^output\d+$/.test(lang)) {
                    const id = lang.replace('output', '')
                    sampleOutputId.push(+id)
                    additional_file.push(`${englishName}${id}.ans`)
                    maxSampleId = Math.max(maxSampleId, +id)
                }
            }
            continue
        }
        if (/^见选手目录/.test(block)) {
            const message = `"${block}" is not a valid big sample description`
            if (!/^见选手目录下的 \[`.+?`\]\(file:\/\/.+?\) 和 \[`.+?`\]\(file:\/\/.+?\)。$/.test(block))
                throwError(message)
            else {
                const result = /^见选手目录下的 \[`(.+?)`\]\(file:\/\/(.+?)\) 和 \[`(.+?)`\]\(file:\/\/(.+?)\)。$/.exec(block) as string[]
                const folder = `${englishName}/${englishName}`
                if (!result[1].startsWith(folder) || !result[1].endsWith('.in')) {
                    throwError(message)
                    continue
                }
                const id = result[1].substring(folder.length, result[1].length - 3)
                if (
                    !/^[0-9][1-9]*$/.test(id) ||
                    result[1] !== `${folder}${id}.in` ||
                    result[2] !== `${englishName}${id}.in` ||
                    result[3] !== `${folder}${id}.ans` ||
                    result[4] !== `${englishName}${id}.ans`
                ) throwError(message)
                else {
                    maxSampleId = Math.max(maxSampleId, +id)
                    sampleInputId.push(+id)
                    sampleOutputId.push(+id)
                    additional_file.push(`${englishName}${id}.in`)
                    additional_file.push(`${englishName}${id}.ans`)
                }
            }
            continue
        }
        const AdditionalFileMatcher = /\[.*?\]\(file\:\/\/(.+?)( .+?)?\)/g
        let file
        while (file = AdditionalFileMatcher.exec(block))
            additional_file.push(file[1])
    }
    let flag = false
    for (let sampleId = 1; sampleId <= maxSampleId; sampleId++) {
        if (sampleInputId[sampleId - 1] !== sampleId) flag = true
        if (sampleOutputId[sampleId - 1] !== sampleId) flag = true
    }
    if (flag) throwError(`Unknown error in samples.`)
    let command
    const CommandMatcher = /<!-- PROBLEM_FORMAT_CHECKER: (.+?) -->/g
    while (command = CommandMatcher.exec(content))
        if (command[1].startsWith('extra_additional_file: '))
            additional_file.push(command[1].replace('extra_additional_file: ', ''))
}

function checkJudgeConfig(config: JudgeConfig) {
    for (let subtask of config.subtasks) {
        for (let testcase of subtask.cases) {
            if (testcase.input !== '/dev/null') {
                testdata.push(testcase.input)
                if (!/^[a-z]*?[\d\-]+?\.in$/.test(testcase.input) || !testcase.input.startsWith(englishName))
                    throwError(`Input file "${testcase.input}" is not a valid name.`)
            }
            if (testcase.output !== '/dev/null') {
                testdata.push(testcase.output)
                if (!/^[a-z]*?[\d\-]+?\.ans$/.test(testcase.output) || !testcase.output.startsWith(englishName))
                    throwError(`Output file "${testcase.output}" is not a valid name.`)
            }
        }
    }
    if (config.checker) {
        if (config.checker !== 'checker.cc')
            throwError(`Checker file must be 'checker.cc'.`)
        testdata.push(config.checker)
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
    for (let pid of pids) {
        nowpid = pid
        maxSampleId = 0
        testdata = ['config.yaml']
        additional_file = []
        sampleInputId = []
        sampleOutputId = []
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
        const files = await service.getFiles(pid)
        if (!files.testdata.includes('config.yaml')) {
            throwError('No judge config file found.')
            continue
        }
        console.log(`Checking judge config`)
        const config = await service.getJudgeConfig(pid)
        checkJudgeConfig(config)
        for (let file of testdata)
            if (!files.testdata.includes(file))
                throwError(`File "${file}" can not found in testdata.`)
        for (let file of additional_file)
            if (!files.additional_file.includes(file))
                throwError(`File "${file}" can not found in additional file.`)
        for (let file of files.testdata)
            if (!testdata.includes(file) && !ALLOW_EXTRA_TESTDATA.includes(file))
                throwError(`Testdata "${file}" is not required.`)
        for (let file of files.additional_file)
            if (!additional_file.includes(file))
                throwError(`Additional file "${file}" is not required.`)
    }
    if (totalError > 0) throw new Error(`Found ${totalError} errors.`)
}

main()
