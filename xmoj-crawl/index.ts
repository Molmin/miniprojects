import { readFileSync } from "fs"
import XMOJAccountService from "./service"

const config = JSON.parse(readFileSync('config.json').toString())

const service = new XMOJAccountService(
    config.username,
    config.password,
)

async function main() {
    await service.ensureLogin()
    const response = await service.get('/contest.php')
    console.log(response.text)
}

main()