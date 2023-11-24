import { existsSync, readdirSync, readFileSync } from "fs"
import HydroAccountService from "../hydrooj-problem-transmission/src/basic/service"
import { XMOJContestDetail } from "./interface"

const config = JSON.parse(readFileSync('config.json').toString())

const hydro = new HydroAccountService(
    'https://hydro.ac',
    `sid=${config.hydro_cookie}`,
    'xmingoj',
)

async function updateContestList(contests: string[]) {
    const DISCUSSION_ID = '656024668f03789237c50a3a'
    const REPLY_ID = '65602684813ec291a5245d64'
    const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

    const disabled = (await hydro
        .get(`/discuss/${DISCUSSION_ID}/${REPLY_ID}/raw`)
        .accept('text/html'))
        .text.trim().split(' ')
    console.log(`${disabled.length} disabled messages found`)

    const markdown = contests
        .map((contestId: string) => {
            const contestDir = `data/contests/${contestId}`
            return JSON.parse(readFileSync(`${contestDir}/contest.json`).toString()) as XMOJContestDetail
        })
        .filter((contest: XMOJContestDetail) =>
            !disabled.includes(`C${contest.contestId}`)
            && !contest.problems.every((problem) => disabled.includes(`P${problem.problemId}`)))
        .map((contest: XMOJContestDetail) => {
            const { contestId } = contest
            const ContestDetail = `http://www.xmoj.tech/contest.php?cid=${contestId}`
            const ContestReview = `http://www.xmoj.tech/contest_video.php?cid=${contestId}`
            return `- #${contestId}. [**${contest.title}**](${ContestDetail})（${contest.date}${contest.review ? `，[回放](${ContestReview})` : ''}）`
                + contest.problems
                    .map((problem, index) => ({ problem, index }))
                    .filter(({ problem }) => !disabled.includes(`P${problem.problemId}`))
                    .map(({ problem, index }) => `\n  \n  ${CHARSET[index]}. [](/p/P${problem.problemId})`).join('')
        }).join('\n\n')
    await hydro.post(`/discuss/${DISCUSSION_ID}/edit`)
        .send({
            operation: 'update',
            title: 'XMOJ 比赛列表',
            highlight: 'on',
            pin: 'on',
            content: markdown,
        })
}

async function main() {
    const username = await hydro.getLoggedInUser()
    if (username === 'Guest') return console.error(`Not logged in`)
    console.log(`Logged in HydroOJ as user ${username}`)
    const problems = readdirSync('data/problems')
    for (let problemId of problems) {
        const pid = `P${problemId}`
        const problemDir = `data/problems/${problemId}`
        const haveSolution = existsSync(`${problemDir}/solution.md`)
            && readFileSync(`${problemDir}/solution.md`).toString().trim().length > 0
        let tags = []
        if (haveSolution) tags.push('有题解')
        const codes = readdirSync(`${problemDir}/codes`)
        if (!codes.every((filename: string) => filename.endsWith('-0.cpp'))) tags.push('有标程')
        if (!await hydro.existsProblem(pid))
            await hydro.createProblem(pid, `${process.cwd()}/${problemDir}`)
        else await hydro.editProblem(pid, `${process.cwd()}/${problemDir}`, tags)
        if (haveSolution) {
            const solutionId = await hydro.getMySolutionId(pid)
            const solution = readFileSync(`${problemDir}/solution.md`).toString()
            if (solutionId.length === 0) {
                const id = await hydro.createSolution(pid, solution)
                console.log(`Sent solution ${id}`)
            }
            else {
                await hydro.updateSolution(pid, solutionId, solution)
                console.log(`Updated solution ${solutionId}`)
            }
        }
        const nowCodes = (await hydro.getFiles(pid)).additional_file
        for (let file of codes) {
            const path = `${problemDir}/codes/${file}`
            if (nowCodes.includes(file)) continue
            await hydro.uploadFile(pid, 'additional_file', file, path)
            console.log(`Uploaded record ${path}`)
        }
        await hydro.uploadFile(pid, 'testdata', 'config.yaml', `${problemDir}/config.yaml`)
        console.log(`Uploaded config file`)
    }
    const contests = readdirSync('data/contests')
    await updateContestList(contests)
    console.log('Updated contest list to discussion')
}

main()