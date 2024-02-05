import { readFileSync, writeFileSync } from 'node:fs'
import { ensureDirSync } from 'fs-extra'
import LuoguAccountService from './service'
import yamljs from 'yamljs'

const config = JSON.parse(readFileSync('config.json').toString())

const luogu = new LuoguAccountService(
    config.uid,
    `_uid=${config.uid}; __client_id=${config.client_id}`,
)

async function main() {
    if (!await luogu.isLoggedIn()) return console.error('Logged in failed')
    console.log('Logged in')
    for (const pid of config.pids) {
        await new Promise((resolve) => setTimeout(resolve, 10000))
        console.log(`Getting problem ${pid}`)
        ensureDirSync(`data/${pid}/testdata`)
        ensureDirSync(`data/${pid}/additional_file`)
        const problem = await luogu.getProblem(pid)
        writeFileSync(`data/${pid}/problem_zh.md`, problem.content)
        writeFileSync(`data/${pid}/problem.yaml`, yamljs.stringify({
            pid,
            owner: 1,
            title: problem.title,
            tag: [],
            nSubmit: 0,
            nAccept: 0,
        }))
        const testdataZip = await luogu.getTestdata(pid)
        testdataZip.extractAllTo(`data/${pid}/testdata/`, true)
        const rids = await luogu.getRecords(pid)
        for (const rid of rids) {
            const record = await luogu.getRecord(rid)
            if (!record) continue
            writeFileSync(`data/${pid}/additional_file/${rid}-${record.score}.cpp`, record.code)
        }
    }
}

main()