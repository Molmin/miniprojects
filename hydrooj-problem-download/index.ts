import { createWriteStream, readFileSync, writeFileSync } from 'fs'
import { ensureDirSync } from 'fs-extra'
import superagent from 'superagent'
import yamljs from 'yamljs'

class Service {
    public logs: string[] = [];
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
    log(content: string) { this.logs.push(content) }

    async getLoggedInUser(): Promise<string> {
        const { body: { UserContext } } = await this.get(`/`)
        const json = JSON.parse(UserContext)
        return json?.uname
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
            stream.on('finish', resolve);
            stream.on('error', reject);
            request.on('error', reject);
            request.on('timeout', reject);
        });
        console.log(`Downloaded File ${target}`)
    }

    async getProblemList(page: number) {
        const list = await this.get('/p').query({ page })
        return list.body.pdocs
    }
}

interface DownloadConfig {
    oj_url: string
    cookie_sid: string
    domain: string
    problem: {
        pid: string
        additional_file: boolean
        testdata: boolean
        statement: boolean
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
    for (let problem of config.problem) {
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
}

main()