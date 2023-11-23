import { readFileSync } from "fs"
import XMOJAccountService from "./service"

const config = JSON.parse(readFileSync('config.json').toString())

const service = new XMOJAccountService(
    config.username,
    config.password,
)

async function main() {
    if (!await service.ensureLogin()) return
    console.log('Logged in')
    const contests = await service.getContests()
    console.log(`Found ${contests.length} contests`)
    let processTotalContests = 0
    for (let contest of contests) {
        processTotalContests++
        await new Promise((resolve) => setTimeout(resolve, 30))
        const { contestId } = contest
        console.log(`[${processTotalContests}/${contests.length}] Getting contest ${contestId} (${contest.title})`)
        const result = await service.getContest(contestId)
        console.log(result)
        let pid = 0
        for (let problem of result.problems) {
            console.log(`[Contest ${contestId}] Getting problem ${pid} #${problem.problemId} ${problem.title}`)
            console.log(await service.getProblem(contestId, pid))
            if (problem.haveSolution) {
                // await service.getSolution(contestId, pid)
            }
            pid++
        }
    }
}

main()