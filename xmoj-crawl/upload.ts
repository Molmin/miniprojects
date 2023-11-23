import { existsSync, readdirSync, readFileSync } from "fs"
import HydroAccountService from "../hydrooj-problem-transmission/src/basic/service"
import { convert, convertCode } from "./utils"

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
    }
}

main()