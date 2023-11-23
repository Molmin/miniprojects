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
        await new Promise((resolve) => setTimeout(resolve, 50))
        const { contestId } = contest
        ensureDirSync(`data/contests/${contestId}`)
        console.log(`[${processTotalContests}/${contests.length}] Getting contest ${contestId} (${contest.title})`)
        const result = await xmoj.getContest(contestId)
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