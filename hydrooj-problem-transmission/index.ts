import { createWriteStream, readFile, readFileSync, readdirSync, writeFileSync } from 'fs'
import { ensureDirSync } from 'fs-extra'
import superagent from 'superagent'
import yamljs from 'yamljs'

class Service {
    constructor(
        public endPoint: string,
        public cookie: string,
        public domainId: string,
    ) { }
    get(url: string) {
        return superagent
            .get(this.endPoint + '/d/' + this.domainId + url)
            .set('Cookie', this.cookie)
            .accept('application/json')
    }
    download(url: string) {
        return superagent
            .get(this.endPoint + url)
            .set('Cookie', this.cookie)
    }
    post(url: string) {
        return superagent
            .post(this.endPoint + '/d/' + this.domainId + url)
            .set('Cookie', this.cookie)
            .accept('application/json')
    }

    async getLoggedInUser(): Promise<string> {
        const { body: { UserContext } } = await this.get(`/`)
        const json = JSON.parse(UserContext)
        return json?.uname
    }

    existsProblem(pid: string): Promise<boolean> {
        return new Promise((resolve, reject) =>
            this.get(`/p/${pid}`)
                .end((error, { status }) => {
                    if (status === 200) resolve(true)
                    else if (status === 404) resolve(false)
                    else reject()
                })
        )
    }

    async getProblemSummary(pid: string, target: string) {
        const { body: { pdoc } } = await this.get(`/p/${pid}`)
        const yaml = {
            pid: pdoc.pid,
            owner: pdoc.owner,
            title: pdoc.title,
            tag: pdoc.tag,
            nSubmit: pdoc.nSubmit,
            nAccept: pdoc.nAccept,
        }
        writeFileSync(`data/${target}/problem.yaml`, yamljs.stringify(yaml, 2))
        let statement: string = pdoc.content
        try { statement = Object.entries(JSON.parse(statement))[0][1] as string }
        catch (e) { }
        writeFileSync(`data/${target}/problem_zh.md`, statement)
        console.log(`Saved Problem Summary`)
    }

    async createProblem(pid: string, path: string) {
        const content = readFileSync(`${path}/problem_zh.md`).toString()
        const { title, tag } = yamljs.load(`${path}/problem.yaml`)
        const response = await this.post('/problem/create')
            .send({
                pid: /^[a-zA-Z]+[a-zA-Z0-9]*$/i.test(pid) ? pid : '',
                tag: tag.join(','),
                difficulty: '',
                title, content,
            })
        console.log(`Created problem ${this.domainId}/${pid}`)
        return response.body.pid
    }

    async getFiles(pid: string) {
        const { body } = await this.get(`/p/${pid}/files`)
        return {
            testdata: body.testdata.map((file: { name: string }) => file?.name),
            additional_file: body.additional_file.map((file: { name: string }) => file?.name),
        }
    }
    async getLinks(pid: string, files: string[], type: 'testdata' | 'additional_file') {
        const links = await this.post(`/p/${pid}/files`)
            .send({ operation: "get_links", type, files })
        return links.body.links
    }

    async downloadFile(link: string, target: string) {
        const request = this.download(link)
        // writeFileSync(`data/${target}`, response.text)
        const stream = createWriteStream(`data/${target}`)
        request.pipe(stream)
        await new Promise((resolve, reject) => {
            stream.on('finish', resolve)
            stream.on('error', reject)
            request.on('error', reject)
            request.on('timeout', reject)
        })
        console.log(`Downloaded File ${target}`)
    }

    async uploadFile(pid: string, type: 'testdata' | 'additional_file', filename: string, path: string) {
        await this.post(`/p/${pid}/files`)
            .field({
                filename, type,
                operation: 'upload_file',
            })
            .attach('file', readFileSync(path))
        return await this.getFiles(pid)
    }
}

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

const config = JSON.parse(readFileSync('secret.json').toString()) as DownloadConfig

const service = new Service(
    config.oj_url,
    `sid=${config.cookie_sid}`,
    config.domain,
)

async function main() {
    const username = await service.getLoggedInUser()
    if (username === 'Guest') return console.error(`Not logged in`)
    console.log(`Logged in ${username}`)
    for (let problem of config.download) {
        const { pid } = problem
        console.log(`Downloading problem ${config.domain}/${pid}`)
        const url_prefix = `${service.domainId}/${pid}`
        ensureDirSync(`data/${url_prefix}/testdata`)
        ensureDirSync(`data/${url_prefix}/additional_file`)
        const { testdata, additional_file } = await service.getFiles(pid)
        if (problem.statement) await service.getProblemSummary(pid, url_prefix)
        if (problem.testdata) {
            const testdata_links = await service.getLinks(pid, testdata, 'testdata')
            for (let [filename, link] of Object.entries(testdata_links))
                await service.downloadFile(link as string, `${url_prefix}/testdata/${filename}`)
        }
        if (problem.additional_file) {
            const additional_file_links = await service.getLinks(pid, additional_file, 'additional_file')
            for (let [filename, link] of Object.entries(additional_file_links))
                await service.downloadFile(link as string, `${url_prefix}/additional_file/${filename}`)
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

main()