import { createWriteStream, readFileSync, writeFileSync } from 'node:fs'
import superagent from 'superagent'
import yamljs from 'yamljs'
import AdmZip from 'adm-zip'

export default class HydroAccountService {
    public uid: number = 0
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
            .retry(20)
    }
    download(url: string) {
        return superagent
            .get(new URL(url, this.endPoint).toString())
            .set('Cookie', this.cookie)
            .retry(20)
    }
    post(url: string) {
        return superagent
            .post(this.endPoint + '/d/' + this.domainId + url)
            .set('Cookie', this.cookie)
            .accept('application/json')
            .retry(20)
    }

    async getLoggedInUser(): Promise<string> {
        const { body: { UserContext } } = await this.get(`/`)
        const json = JSON.parse(UserContext)
        this.uid = json._id
        return json?.uname
    }
    async login(uname: string, password: string) {
        console.log('Try login')
        const response = await this
            .post('/login')
            .send({ uname, password })
        this.cookie = response.header['set-cookie']
    }

    async listProblems(): Promise<string[]> {
        let countPages = 1, list: string[] = []
        for (let page = 1; page <= countPages; page++) {
            console.log(`Getting page ${page} / ${countPages}`)
            let { body: { ppcount, pdocs } } = await this
                .get('/p').query({ page })
            countPages = ppcount
            pdocs = pdocs.filter((pdoc: { hidden: boolean }) => !pdoc.hidden)
            pdocs = pdocs.map((pdoc: { pid: string }) => pdoc.pid) as string[]
            list = list.concat(pdocs)
        }
        return list
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
        return pdoc.reference ?? { domainId: this.domainId, pid }
    }

    async getProblemTitle(pid: string): Promise<string> {
        const { body: { pdoc } } = await this.get(`/p/${pid}`)
        return pdoc.title
    }

    async getProblemStatement(pid: string): Promise<Record<string, string>> {
        const { body: { pdoc } } = await this.get(`/p/${pid}`)
        let statement = pdoc.content
        try { statement = JSON.parse(statement) }
        catch (e) { statement = { zh: statement } }
        return statement
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
                hidden: true,
            })
        console.log(`Created problem ${this.domainId}/${pid}`)
        return response.body.pid
    }
    async editProblem(pid: string, path: string, tags: string[] = []) {
        const content = readFileSync(`${path}/problem_zh.md`).toString()
        const { title, tag } = yamljs.load(`${path}/problem.yaml`)
        const response = await this.post(`/p/${pid}/edit`)
            .send({
                pid: /^[a-zA-Z]+[a-zA-Z0-9]*$/i.test(pid) ? pid : '',
                tag: (tags.length === 0 ? tag : tags).join(','),
                difficulty: '',
                title, content,
                hidden: true,
            })
        console.log(`Edited problem ${this.domainId}/${pid}`)
        return response.body.pid
    }

    async getMySolutionId(pid: string): Promise<string> {
        const { body: { psdocs } } = await this.get(`/p/${pid}/solution`)
        const my = psdocs.filter((psdoc: any) => psdoc.owner === this.uid)
        return my.length === 0 ? '' : my[0]._id
    }
    async createSolution(pid: string, content: string) {
        const { body } = await this.post(`/p/${pid}/solution`)
            .send({ operation: 'submit', content })
        return body.psid
    }
    async updateSolution(pid: string, solutionId: string, content: string) {
        await this.post(`/p/${pid}/solution`)
            .send({ operation: 'edit_solution', psid: solutionId, content })
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

    async getJudgeConfig(pid: string) {
        const filename = 'config.yaml'
        await this.downloadFile((await this.getLinks(pid, [filename], 'testdata'))[filename], `tmp/config-${pid}.yaml`)
        return yamljs.load(`data/tmp/config-${pid}.yaml`)
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
        let upload = readFileSync(path)
        if (type === 'testdata') {
            let zip = new AdmZip()
            zip.addFile(filename, upload, "")
            upload = zip.toBuffer()
            filename = 'data.zip'
        }
        await this.post(`/p/${pid}/files`)
            .field({
                filename, type,
                operation: 'upload_file',
            })
            .attach('file', upload)
        return await this.getFiles(pid)
    }
}
