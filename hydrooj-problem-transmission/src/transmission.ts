import {
    existsSync, readFileSync, readdirSync,
    writeFileSync,
} from 'node:fs'
import { ensureDirSync } from 'fs-extra'
import HydroAccountService from './basic/service'
import { SecretConfig } from './basic/secret'

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

function renameFunc(filename: string, type: 'testdata' | 'additional_file') {
    return filename
}

async function main() {
    const username = await service.getLoggedInUser()
    if (username === 'Guest') return console.error(`Not logged in`)
    console.log(`Logged in as user ${username}`)
    for (let pid of config.download) {
        console.log(`Downloading problem ${secret.domain}/${pid}`)
        const path_prefix = `${service.domainId}/${pid}`
        ensureDirSync(`data/${path_prefix}/testdata`)
        ensureDirSync(`data/${path_prefix}/additional_file`)
        let { testdata, additional_file } = await service.getFiles(pid)
        await service.getProblemSummary(pid, path_prefix)

        testdata = testdata.filter((filename: string) => {
            const path = `data/${path_prefix}/testdata/${filename}`
            return !progress[path]
        })
        console.log(`Downloading total ${testdata.length} files`)
        const testdata_links = await service.getLinks(pid, testdata, 'testdata')
        for (let [filename, link] of Object.entries(testdata_links)) {
            const path = `data/${path_prefix}/testdata/${filename}`
            setProgress(path, false)
            await service.downloadFile(link as string, `${path_prefix}/testdata/${filename}`)
            setProgress(path, true)
        }

        additional_file = additional_file.filter((filename: string) => {
            const path = `data/${path_prefix}/additional_file/${filename}`
            return !progress[path]
        })
        console.log(`Downloading total ${additional_file.length} files`)
        const additional_file_links = await service.getLinks(pid, additional_file, 'additional_file')
        for (let [filename, link] of Object.entries(additional_file_links)) {
            const path = `data/${path_prefix}/additional_file/${filename}`
            setProgress(path, false)
            await service.downloadFile(link as string, `${path_prefix}/additional_file/${filename}`)
            setProgress(path, true)
        }
    }
    for (let problem of config.upload) {
        const { path } = problem
        let pid = problem.pid
        console.log(`Uploading problem ${secret.domain}/${pid}`)
        if (!await service.existsProblem(pid))
            pid = await service.createProblem(pid, path)
        const testdata = readdirSync(`${path}/testdata`)
        const additional_file = readdirSync(`${path}/additional_file`)
        let files = await service.getFiles(pid)
        for (let file of testdata) {
            const filename = renameFunc(file, 'testdata')
            if (files.testdata.includes(filename)) continue
            files = await service.uploadFile(pid, 'testdata', filename, `${path}/testdata/${file}`)
            if (files.testdata.includes(filename))
                console.log(`Successfully uploaded file ${filename}`)
            else console.log(`Failed to upload file ${filename}`)
        }
        for (let file of additional_file) {
            const filename = renameFunc(file, 'additional_file')
            if (files.additional_file.includes(filename)) continue
            files = await service.uploadFile(pid, 'additional_file', filename, `${path}/additional_file/${file}`)
            if (files.additional_file.includes(filename))
                console.log(`Successfully uploaded file ${filename}`)
            else console.log(`Failed to upload file ${filename}`)
        }
    }
}

async function start() {
    try { await main() }
    catch (e) {
        console.error(e)
        console.log('Restarting script')
        start()
    }
}

start()