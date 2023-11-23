import { existsSync, readdirSync, readFileSync } from "fs"
import HydroAccountService from "../hydrooj-problem-transmission/src/basic/service"

const config = JSON.parse(readFileSync('config.json').toString())

const hydro = new HydroAccountService(
    'https://hydro.ac',
    `sid=${config.hydro_cookie}`,
    'xmingoj',
)

async function main() {
    const username = await hydro.getLoggedInUser()
    if (username === 'Guest') return console.error(`Not logged in`)
    console.log(`Logged in HydroOJ as user ${username}`)
    const problems = readdirSync('data/problems')
    for (let problemId of problems) {
        const problemDir = `data/problems/${problemId}`
        const haveSolution = existsSync(`${problemDir}/solution.md`)
            && readFileSync(`${problemDir}/solution.md`).toString().trim().length > 0
        let tags = []
        if (haveSolution) tags.push('有题解')
        if (!await hydro.existsProblem(`P${problemId}`))
            await hydro.createProblem(`P${problemId}`, `${process.cwd()}/${problemDir}`)
        else await hydro.editProblem(`P${problemId}`, `${process.cwd()}/${problemDir}`, tags)
        if (haveSolution) {
            const solutionId = await hydro.getMySolutionId(`P${problemId}`)
            const solution = readFileSync(`${problemDir}/solution.md`).toString()
            if (solutionId.length === 0) {
                const id = await hydro.createSolution(`P${problemId}`, solution)
                console.log(`Sent solution ${id}`)
            }
            else {
                await hydro.updateSolution(`P${problemId}`, solutionId, solution)
                console.log(`Updated solution ${solutionId}`)
            }
        }
    }
}

main()