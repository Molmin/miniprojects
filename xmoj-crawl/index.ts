import { readFileSync, writeFileSync } from "fs"
import { ensureDirSync } from "fs-extra"
import XMOJAccountService from "./service"
import yamljs from "yamljs"

const config = JSON.parse(readFileSync('config.json').toString())

const xmoj = new XMOJAccountService(
    config.username,
    config.password,
)

let gettedProblems: number[] = []

async function main() {
    if (!await xmoj.ensureLogin()) return console.error('Logged in failed')
    console.log('Logged in XMOJ')
    const contests = await xmoj.getContests()
    console.log(`Found ${contests.length} contests`)
    let processTotalContests = 0
    for (let contest of contests) {
        processTotalContests++
        await new Promise((resolve) => setTimeout(resolve, 100))
        const { contestId } = contest
        console.log(`[${processTotalContests}/${contests.length}] Getting contest ${contestId} (${contest.title})`)
        const result = await xmoj.getContest(contestId)
        if (!result || result.date < config.shouldAfter) continue
        ensureDirSync(`data/contests/${contestId}`)
        writeFileSync(`data/contests/${contestId}/contest.json`, JSON.stringify(result, null, '  '))
        let pid = 0
        for (let problem of result.problems) {
            const problemDir = `data/problems/${problem.problemId}`
            if (gettedProblems.includes(problem.problemId))
                console.log(`[${contestId}] Skipped problem ${pid} #${problem.problemId} ${problem.title}`)
            else {
                gettedProblems.push(problem.problemId)
                ensureDirSync(problemDir)
                ensureDirSync(`${problemDir}/codes`)
                console.log(`[${contestId}] Getting problem ${pid} #${problem.problemId} ${problem.title}`)
                const res = await xmoj.getProblem(contestId, pid)
                writeFileSync(`${problemDir}/problem_zh.md`, res.content.trim() === '' ? '[]()' : res.content)
                writeFileSync(`${problemDir}/problem.yaml`, yamljs.stringify({ title: res.title, tag: [] }))
                if (!/^[\d\.]+? Sec$/.test(res.judge.time))
                    throw new Error(`Error format at ${problem.problemId}`)
                if (!/^[\d\.]+? MB$/.test(res.judge.memory))
                    throw new Error(`Error format at ${problem.problemId}`)
                if (res.judge.input === '标准输入') {
                    if (res.judge.output !== '标准输出')
                        throw new Error(`Error format at ${problem.problemId}`)
                }
                else if (!/^[A-Za-z0-9]+?\.in$/.test(res.judge.input))
                    throw new Error(`Error format at ${problem.problemId}`)
                else if (res.judge.input.split('.')[0] + '.out' !== res.judge.output)
                    throw new Error(`Error format at ${problem.problemId}`)
                let config: Record<string, string> = {
                    time: `${+res.judge.time.split(' ')[0]}s`,
                    memory: `${+res.judge.memory.split(' ')[0]}m`,
                }
                if (res.judge.input !== '标准输入')
                    config.filename = res.judge.input.split('.')[0]
                writeFileSync(`${problemDir}/config.yaml`, yamljs.stringify(config))
                const records = await xmoj.getRecords(problem.problemId)
                for (let recordId of records) {
                    console.log(`Getting record ${recordId}`)
                    const record = await xmoj.getRecord(contestId, pid, recordId)
                    writeFileSync(`${problemDir}/codes/${recordId}-${record.accepted ? 100 : 0}.cpp`, record.code)
                }
            }
            if (problem.haveSolution) {
                const solution = await xmoj.getSolution(contestId, pid)
                writeFileSync(`${problemDir}/solution.md`, solution)
            }
            if (problem.haveStandardCode) {
                const code = await xmoj.getCode(contestId, pid)
                writeFileSync(`${problemDir}/codes/std-100.cpp`, code)
            }
            pid++
        }
    }
}

main()