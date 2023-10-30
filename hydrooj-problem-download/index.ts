import { writeFileSync } from 'fs'
import { ensureDirSync } from 'fs-extra'
import superagent from 'superagent'

class Service {
    public logs: string[] = [];
    constructor(
        public endPoint: string,
        public cookie: string,
        public domainId: string,
    ) { }
    get(url: string, nodomain = false) {
        return superagent
            .get(this.endPoint + (nodomain ? '' : '/d/' + this.domainId) + url)
            .set('Cookie', this.cookie)
            .accept('application/json')
    }
    post(url: string, nodomain = false) {
        return superagent
            .post(this.endPoint + (nodomain ? '' : '/d/' + this.domainId) + url)
            .set('Cookie', this.cookie)
            .accept('application/json')
    }
    log(content: string) { this.logs.push(content) }

    async checkLoggedIn(): Promise<string> {
        const { body: { UserContext } } = await this.get(`/`)
        const json = JSON.parse(UserContext)
        return json?.uname
    }

    async getFiles(pid: string) {
        const files = await this.get(`/p/${pid}/files`)
        ensureDirSync(`data/${this.domainId}_${pid}`)
        let tmp: string = files.body.pdoc.content
        if (tmp.startsWith('{')) tmp = JSON.parse(tmp).zh
        writeFileSync(`data/${this.domainId}_${pid}/problem.txt`, `# ${files.body.pdoc.title}\n\n${tmp}`)
        return files.body.testdata.map((file: { name: string }) => file?.name)
    }

    async getLinks(pid: string, files: string[]) {
        const links = await this.post(`/p/${pid}/files`)
            .send({
                operation: "get_links",
                type: "testdata",
                files,
            })
        console.log(links.body.links)
        return links.body.links
    }

    async downloadFile(pid: string, filename: string, link: string) {
        const response = await this.get(link, true)
        // writeFileSync(`/data/${this.domainId}_${pid}/${filename}`, response.body, 'binary')
        writeFileSync(`data/${this.domainId}_${pid}/${filename}`, response.text)
        console.log(`Downloaded File ${this.domainId}/${pid}/${filename}`)
    }

    async getProblemList(page: number) {
        const list = await this.get('/p').query({ page })
        return list.body.pdocs
    }
}

const service = new Service(
    'https://oj.hailiangedu.com',
    'sid=',
    'MainProblems',
)

async function main() {
    const username = await service.checkLoggedIn()
    if (username === 'Guest') return console.log(`Not logged in`)
    console.log(`Logged in ${username}`)
    const pid = 'P10003'
    const files = await service.getFiles(pid)
    const links = await service.getLinks(pid, files)
    for (let [filename, link] of Object.entries(links))
        await service.downloadFile(pid, filename, link as string)
    // {
    //     ensureDirSync('data/problem')
    //     let list = ''
    //     for (let page = 1; page <= 18; page++) {
    //         const pdocs = await service.getProblemList(page)
    //         list += pdocs.map((pdoc: Record<string, any>) => pdoc.pid
    //             ? `${pdoc.pid} (${pdoc.docId}) ${pdoc.title}`
    //             : `${pdoc.docId} ${pdoc.title}`).join('\n')
    //     }
    //     writeFileSync(`data/problem/${service.domainId}.txt`, list)
    // }
}

main()