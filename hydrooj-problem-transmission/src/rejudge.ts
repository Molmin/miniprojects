import { readFileSync } from 'node:fs'
import HydroAccountService from './basic/service'
import { SecretConfig } from './basic/secret'

console.log({
    JobConfigFile: process.argv[2] || 'job.json',
    SecretConfigFile: process.argv[3] || 'secret.json',
})

const config = JSON.parse(readFileSync(process.argv[2] || 'job.json').toString()) as { pid: string }
const secret = JSON.parse(readFileSync(process.argv[3] || 'secret.json').toString()) as SecretConfig

const service = new HydroAccountService(
    secret.oj_url,
    `sid=${secret.cookie_sid}`,
    secret.domain,
)

async function getRecords(pid: string): Promise<string[]> {
    let rids: string[] = []
    for (let page = 1; ; page++) {
        const { body: { rdocs } } = await service.get('/record').query({ page, pid })
        if (rdocs.length === 0) break
        rids = rids.concat(rdocs
            .filter((rdoc: any) => rdoc.status !== 9)
            .filter((rdoc: any) => (Date.now() - new Date(rdoc.judgeAt).getTime()) / 1000 / 60 > 100)
            .map((rdoc: any) => rdoc._id))
    }
    return rids
}

async function main() {
    const username = await service.getLoggedInUser()
    if (username === 'Guest') return console.error(`Not logged in`)
    console.log(`Logged in as user ${username}`)
    const rids = await getRecords(config.pid)
    console.log(`${rids.length} records found.`)
    for (let rid of rids) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        await service.post(`/record/${rid}`)
            .send({ operation: 'rejudge' })
        console.log(`Rejudged record ${rid}`)
    }
}

main()