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
            if (gettedProblems.includes(problem.problemId)) {
                console.log(`[${contestId}] Skipped problem ${pid} #${problem.problemId} ${problem.title}`)
                continue
            }
            gettedProblems.push(problem.problemId)
            const problemDir = `data/problems/${problem.problemId}`
            ensureDirSync(problemDir)
            console.log(`[${contestId}] Getting problem ${pid} #${problem.problemId} ${problem.title}`)
            const res = await xmoj.getProblem(contestId, pid)
            writeFileSync(`${problemDir}/problem_zh.md`, res.content.trim() === '' ? '[]()' : res.content)
            writeFileSync(`${problemDir}/problem.yaml`, yamljs.stringify({ title: res.title, tag: [] }))
            if (problem.haveSolution) {
                const solution = await xmoj.getSolution(contestId, pid)
                writeFileSync(`${problemDir}/solution.md`, solution)
            }
            pid++
        }
    }
}

main()