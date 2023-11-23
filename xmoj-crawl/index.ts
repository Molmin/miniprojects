import { readFileSync, writeFileSync } from "fs"
import { ensureDirSync, write } from "fs-extra"
import XMOJAccountService from "./service"
import HydroAccountService from "../hydrooj-problem-transmission/src/basic/service"
import yamljs from "yamljs"

const config = JSON.parse(readFileSync('config.json').toString())

const xmoj = new XMOJAccountService(
    config.username,
    config.password,
)

const hydro = new HydroAccountService(
    'https://hydro.ac',
    `sid=${config.hydro_cookie}`,
    'xmingoj',
)

let gettedProblems: number[] = []

async function main() {
    {
        if (!await xmoj.ensureLogin()) return console.error('Logged in failed')
        console.log('Logged in XMOJ')
    }
    {
        const username = await hydro.getLoggedInUser()
        if (username === 'Guest') return console.error(`Not logged in`)
        console.log(`Logged in HydroOJ as user ${username}`)
    }
    const contests = await xmoj.getContests()
    console.log(`Found ${contests.length} contests`)
    let processTotalContests = 0
    for (let contest of contests) {
        processTotalContests++
        await new Promise((resolve) => setTimeout(resolve, 300))
        const { contestId } = contest
        ensureDirSync(`data/contests/${contestId}`)
        console.log(`[${processTotalContests}/${contests.length}] Getting contest ${contestId} (${contest.title})`)
        const result = await xmoj.getContest(contestId)
        writeFileSync(`data/contests/${contestId}/contest.json`, JSON.stringify(result, null, '  '))
        let pid = 0
        for (let problem of result.problems) {
            if (`${problem.problemId}` === 'NaN')
                throw new Error(`Contest ${contestId}`)
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
                // await service.getSolution(contestId, pid)
            }
            if (!await hydro.existsProblem(`P${problem.problemId}`))
                await hydro.createProblem(`P${problem.problemId}`, `${process.cwd()}/${problemDir}`)
            else await hydro.editProblem(`P${problem.problemId}`, `${process.cwd()}/${problemDir}`)
            pid++
        }
    }
}

main()