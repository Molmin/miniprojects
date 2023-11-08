import {
    existsSync, readFileSync, readdirSync,
    writeFileSync,
} from 'node:fs'
import { ensureDirSync } from 'fs-extra'
import HydroAccountService from './service'

interface DownloadConfig {
    oj_url: string
    cookie_sid: string
    domain: string
    download: {
        pid: string
        additional_file: boolean
        testdata: boolean
        statement: boolean
    }[]
    upload: {
        pid: string
        path: string
    }[]
}

const config = JSON.parse(readFileSync(process.argv[2] || 'secret.json').toString()) as DownloadConfig

const service = new HydroAccountService(
    config.oj_url,
    `sid=${config.cookie_sid}`,
    config.domain,
)

let progress: Record<string, boolean> = {}
if (existsSync('data/progress.json'))
    progress = JSON.parse(readFileSync('data/progress.json').toString())

function setProgress(key: string, value: boolean) {
    progress[key] = value
    writeFileSync('data/progress.json', JSON.stringify(progress, null, '  '))
}

async function main() {
    const username = await service.getLoggedInUser()
    if (username === 'Guest') return console.error(`Not logged in`)
    console.log(`Logged in ${username}`)
    for (let problem of config.download) {
        const { pid } = problem
        console.log(`Downloading problem ${config.domain}/${pid}`)
        const path_prefix = `${service.domainId}/${pid}`
        ensureDirSync(`data/${path_prefix}/testdata`)
        ensureDirSync(`data/${path_prefix}/additional_file`)
        let { testdata, additional_file } = await service.getFiles(pid)
        if (problem.statement) await service.getProblemSummary(pid, path_prefix)
        if (problem.testdata) {
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
        }
        if (problem.additional_file) {
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
    }
    for (let problem of config.upload) {
        const { path } = problem
        let pid = problem.pid
        console.log(`Uploading problem ${config.domain}/${pid}`)
        if (!await service.existsProblem(pid))
            pid = await service.createProblem(pid, path)
        const testdata = readdirSync(`${path}/testdata`)
        const additional_file = readdirSync(`${path}/additional_file`)
        let files = await service.getFiles(pid)
        for (let file of testdata) {
            if (files.testdata.includes(file)) continue
            files = await service.uploadFile(pid, 'testdata', file, `${path}/testdata/${file}`)
            if (files.testdata.includes(file))
                console.log(`Successfully uploaded file ${file}`)
            else console.log(`Failed to upload file ${file}`)
        }
        for (let file of additional_file) {
            if (files.additional_file.includes(file)) continue
            files = await service.uploadFile(pid, 'additional_file', file, `${path}/additional_file/${file}`)
            if (files.additional_file.includes(file))
                console.log(`Successfully uploaded file ${file}`)
            else console.log(`Failed to upload file ${file}`)
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