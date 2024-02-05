import {
    existsSync, readFileSync, readdirSync,
    writeFileSync,
} from 'node:fs'
import { ensureDirSync } from 'fs-extra'
import HydroAccountService from './basic/service'
import { SecretConfig } from './basic/secret'
import { Queue } from './queue'

interface TransmissionConfig {
    download: string[]
    upload: {
        pid: string
        path: string
    }[]
}

console.log({
    JobConfigFile: process.argv[2] || 'job.json',
    SecretConfigFile: process.argv[3] || 'secret.json',
})

const config = JSON.parse(readFileSync(process.argv[2] || 'job.json').toString()) as TransmissionConfig
const secret = JSON.parse(readFileSync(process.argv[3] || 'secret.json').toString()) as SecretConfig

const service = new HydroAccountService(
    secret.oj_url,
    `sid=${secret.cookie_sid}`,
    secret.domain,
)

let progress: Record<string, boolean> = {}
if (existsSync('data/progress.json'))
    progress = JSON.parse(readFileSync('data/progress.json').toString())

function setProgress(key: string, value: boolean) {
    progress[key] = value
    writeFileSync('data/progress.json', JSON.stringify(progress, null, '  '))
}

const queue = new Queue(5)

async function main() {
    const username = await service.getLoggedInUser()
    if (username === 'Guest') return console.error(`Not logged in`)
    console.log(`Logged in as user ${username}`)
    for (let pid of config.download) {
        // await new Promise((resolve) => setTimeout(resolve, 500))
        service.domainId = secret.domain
        console.log(`Downloading problem ${secret.domain}/${pid}`)
        const path_prefix = `${service.domainId}/${pid}`
        ensureDirSync(`data/${path_prefix}/testdata`)
        ensureDirSync(`data/${path_prefix}/additional_file`)
        const reference = await service.getProblemSummary(pid, path_prefix)
        service.domainId = reference.domainId
        let { testdata, additional_file } = await service.getFiles(reference.pid)

        testdata = testdata.filter((filename: string) => {
            const path = `data/${path_prefix}/testdata/${filename}`
            return !progress[path]
        })
        additional_file = additional_file.filter((filename: string) => {
            const path = `data/${path_prefix}/additional_file/${filename}`
            return !progress[path]
        })
        const testdata_links = await service.getLinks(reference.pid, testdata, 'testdata')
        const additional_file_links = await service.getLinks(reference.pid, additional_file, 'additional_file')

        console.log(`Downloading total ${testdata.length} testdatas and ${additional_file.length} additional_files`)
        const tasks = []
        for (const [filename, link] of Object.entries(testdata_links)) {
            tasks.push(queue.waitForTask(async () => {
                const path = `data/${path_prefix}/testdata/${filename}`
                setProgress(path, false)
                await service.downloadFile(link as string, `${path_prefix}/testdata/${filename}`)
                setProgress(path, true)
            }))
        }
        for (const [filename, link] of Object.entries(additional_file_links)) {
            tasks.push(queue.waitForTask(async () => {
                const path = `data/${path_prefix}/additional_file/${filename}`
                setProgress(path, false)
                await service.downloadFile(link as string, `${path_prefix}/additional_file/${filename}`)
                setProgress(path, true)
            }))
        }
        await Promise.all(tasks)
    }
    service.domainId = secret.domain
    for (let problem of config.upload) {
        const { path } = problem
        let pid = problem.pid
        console.log(`Uploading problem ${secret.domain}/${pid}`)
        if (!await service.existsProblem(pid))
            pid = await service.createProblem(pid, path)
        function toSortString(str: string) {
            return str.replace(/(\d+)/g, (s) => s.padStart(6, '0'));
        }
        function sortFunc(x: string, y: string) {
            if (toSortString(x) === toSortString(y)) return x < y ? -1 : 1
            else return toSortString(x) < toSortString(y) ? -1 : 1
        }
        const testdata = readdirSync(`${path}/testdata`).sort(sortFunc)
        const additional_file = readdirSync(`${path}/additional_file`).sort(sortFunc)
        let files = await service.getFiles(pid)
        const tasks = []
        for (const file of testdata) {
            tasks.push(queue.waitForTask(async () => {
                if (files.testdata.includes(file)) return
                files = await service.uploadFile(pid, 'testdata', file, `${path}/testdata/${file}`)
                if (files.testdata.includes(file))
                    console.log(`Successfully uploaded file ${file}`)
                else console.log(`Failed to upload file ${file}`)
            }))
        }
        for (const file of additional_file) {
            tasks.push(queue.waitForTask(async () => {
                if (files.additional_file.includes(file)) return
                files = await service.uploadFile(pid, 'additional_file', file, `${path}/additional_file/${file}`)
                if (files.additional_file.includes(file))
                    console.log(`Successfully uploaded file ${file}`)
                else console.log(`Failed to upload file ${file}`)
            }))
        }
        await Promise.all(tasks)
    }
}

async function start() {
    try {
        await main()
        queue.close()
        console.log('Done')
    }
    catch (e) {
        console.error(e)
        console.log('Restarting script')
        start()
    }
}

start()