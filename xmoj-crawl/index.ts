import { readFileSync, writeFileSync } from "fs"
import { ensureDirSync } from "fs-extra"
import XMOJAccountService from "./service"

const config = JSON.parse(readFileSync('config.json').toString())

const service = new XMOJAccountService(
    config.username,
    config.password,
)

let gettedProblems: number[] = []

async function main() {
    if (!await service.ensureLogin()) return
    console.log('Logged in')
    const contests = await service.getContests()
    console.log(`Found ${contests.length} contests`)
    let processTotalContests = 0
    for (let contest of contests) {
        processTotalContests++
        await new Promise((resolve) => setTimeout(resolve, 300))
        const { contestId } = contest
        ensureDirSync(`data/contests/${contestId}`)
        console.log(`[${processTotalContests}/${contests.length}] Getting contest ${contestId} (${contest.title})`)
        const result = await service.getContest(contestId)
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
            const res = await service.getProblem(contestId, pid)
            writeFileSync(`${problemDir}/statement.md`, res.content)
            if (problem.haveSolution) {
                // await service.getSolution(contestId, pid)
            }
            pid++
        }
    }
}

main()