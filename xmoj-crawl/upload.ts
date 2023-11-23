import { readdirSync, readFileSync, writeFileSync } from "fs"
import { ensureDirSync, write } from "fs-extra"
import HydroAccountService from "../hydrooj-problem-transmission/src/basic/service"
import yamljs from "yamljs"

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
        if (!await hydro.existsProblem(`P${problemId}`))
            await hydro.createProblem(`P${problemId}`, `${process.cwd()}/${problemDir}`)
        else await hydro.editProblem(`P${problemId}`, `${process.cwd()}/${problemDir}`)
    }
}

main()