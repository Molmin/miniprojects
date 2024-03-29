import superagent from 'superagent'
import { JSDOM } from 'jsdom'
import crypto from 'node:crypto'
import { XMOJContest, XMOJContestDetail, XMOJProblemDetail } from './interface'
import { convert, convertHTML } from './utils'

function md5(str: string) {
    const md5 = crypto.createHash('md5')
    const result = md5.update(str).digest('hex')
    return result
}

const UA = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'AppleWebKit/537.36 (KHTML, like Gecko)',
    'Chrome/118.0.0.0 Safari/537.36 Edg/118.0.2088.76',
].join(' ')

export default class XMOJAccountService {
    private cookie: string = ''
    constructor(
        private username: string,
        private password: string,
        public endPoint = 'http://www.xmoj.tech',
    ) { }
    get(url: string) {
        return superagent
            .get(this.endPoint + url)
            .set('Cookie', this.cookie)
            .set('User-Agent', UA)
    }
    post(url: string) {
        return superagent
            .post(this.endPoint + url)
            .set('Cookie', this.cookie)
            .set('User-Agent', UA)
    }

    async isLoggedIn(): Promise<boolean> {
        const home = await this.get('/')
        const { window: { document } } = new JSDOM(home.text)
        const path = document.querySelector('ul.dropdown-menu[role="menu"] > script')?.getAttribute('src') || ''
        const response = await this.get('/' + path)
        return !response.text.includes('登录')
    }

    async getCsrfToken(): Promise<string> {
        const { text } = await this.get('/csrf.php')
        const { window: { document } } = new JSDOM(text)
        return document.querySelector('input')?.value as string
    }

    async login() {
        console.log('Try login')
        const response = await this.get('/loginpage.php')
        this.cookie = response.header['set-cookie']
        console.log(`Cookie updated: ${this.cookie}`)
        const csrf = await this.getCsrfToken()
        const { text } = await this.post('/login.php')
            .type('form')
            .send({
                user_id: this.username,
                password: md5(this.password),
                submit: '',
                csrf,
            })
        if (text.includes('alert'))
            console.error('Username or password wrong!')
    }

    async ensureLogin(): Promise<boolean> {
        if (await this.isLoggedIn()) return true
        await this.login()
        return await this.isLoggedIn()
    }

    async getPageContests(page = 1) {
        const response = await this.get('/contest.php').query({ page })
        const { window: { document } } = new JSDOM(response.text)
        const table = document.querySelectorAll('table.table.table-striped > tbody > tr')
        let contests: XMOJContest[] = []
        for (let contest of table) {
            contests.push({
                contestId: +(contest.querySelector('td:nth-child(1)')?.textContent?.trim() as string),
                title: contest.querySelector('td:nth-child(2)')?.textContent?.trim() as string,
            })
        }
        return contests
    }

    async getContests() {
        let contests: XMOJContest[] = []
        for (let page = 1; ; page++) {
            console.log(`Getting contest list page ${page}`)
            const result = await this.getPageContests(page)
            if (result.length === 0) break
            contests = contests.concat(result)
        }
        return contests
    }

    async getContest(contestId: number): Promise<XMOJContestDetail | null> {
        const response = await this.get('/contest.php').query({ cid: contestId })
        if (response.text.includes('比赛尚未开始或私有，不能查看题目。')) return null
        const { window: { document } } = new JSDOM(response.text)
        const title = document.querySelector('title')?.textContent as string
        const mainNode = document.querySelector('center') as Element
        const date = mainNode
            .querySelectorAll('font')[0]
            .textContent?.split(' ')[0] as string
        let review = false
        for (let node of mainNode.querySelectorAll('a'))
            if (node.textContent === '回看') review = true
        const problemNodes = mainNode.querySelectorAll('table#problemset > tbody > tr')
        const headerNodes = []
        for (let node of mainNode.querySelectorAll('table#problemset > thead > tr > td'))
            headerNodes.push(node.textContent?.trim())
        let solutionIndex = 0, codeIndex = 0
        if (headerNodes.includes('题解'))
            while (headerNodes[solutionIndex] !== '题解') solutionIndex++
        if (headerNodes.includes('标程'))
            while (headerNodes[codeIndex] !== '标程') codeIndex++
        let problems = []
        for (let problemNode of problemNodes) {
            let nodes = []
            for (let node of problemNode.querySelectorAll('td'))
                nodes.push(node.textContent?.trim() as string)
            let problem = {
                title: nodes[2],
                problemId: +(/(\d+)[^\d]/.exec(nodes[1]) as string[])[1],
                haveSolution: false,
                haveStandardCode: false,
            }
            if (solutionIndex && nodes[solutionIndex] === '打开')
                problem.haveSolution = true
            if (codeIndex && nodes[codeIndex] === '打开')
                problem.haveStandardCode = true
            problems.push(problem)
        }
        return {
            contestId,
            title,
            date,
            review,
            problems,
        }
    }

    async getProblem(
        contestId: number, problemId: number,
    ): Promise<XMOJProblemDetail> {
        const response = await this
            .get('/problem.php')
            .query({ cid: contestId, pid: problemId })
        const { window: { document } } = new JSDOM(response.text)
        const imgs = document.querySelectorAll('img')
        for (let img of imgs) {
            const src = img.getAttribute('src') as string
            const url = new URL(src, this.endPoint).href
            img.setAttribute('src', url)
        }
        const links = document.querySelectorAll('a')
        for (let link of links) {
            const src = link.getAttribute('href') as string
            const url = new URL(src, this.endPoint).href
            link.setAttribute('href', url)
        }
        const mainNode = document.querySelector('center') as Element
        const id = +(mainNode
            ?.querySelectorAll('a')[1]
            .getAttribute('href') as string)
            .split('?id=')[1]
        const title = (document
            .querySelector('title')?.textContent as string)
            .split(' ').splice(2).join(' ')
        const sections = document.querySelectorAll('div.cnt-row')
        let content = ''
        for (let section of sections) {
            const title = section.querySelector('.cnt-row-head')?.textContent
            const samples = section.querySelectorAll('.data-sample')
            if (samples.length > 0) {
                for (let sampleNode of samples) {
                    if (sampleNode.querySelector('.in-out')?.innerHTML.trim() !== '') {
                        const sampleId = sampleNode
                            .querySelector('.in-out-item > .title')
                            ?.textContent?.split('#')[1] as string
                        const sampleTextNodes = sampleNode
                            .querySelectorAll('span.sampledata')
                        const input = convert(sampleTextNodes[0].textContent as string)
                        const output = convert(sampleTextNodes[1].textContent as string)
                        content += `\`\`\`input${sampleId}\n${input}\n\`\`\`\n\n`
                        content += `\`\`\`output${sampleId}\n${output}\n\`\`\`\n\n`
                    }
                    const descriptionNode = sampleNode.querySelector('.content.lang_cn')
                    if (descriptionNode !== null) {
                        const titleNode = descriptionNode
                            .parentElement?.querySelector('.title') as Element
                        content += `## ${titleNode.textContent}\n\n`
                        content += `${convertHTML(descriptionNode)}\n\n`
                    }
                }
            }
            else {
                const text = convertHTML(section.querySelector('.content.lang_cn') as Element)
                content += `## ${title}\n\n${text}\n\n`
            }
        }
        return {
            problemId: id,
            title,
            content,
            judge: {
                input: mainNode?.innerHTML.split('输入文件: </span>')[1].split('&nbsp;')[0].split('<br>')[0],
                output: mainNode?.innerHTML.split('输出文件: </span>')[1].split('&nbsp;')[0].split('<br>')[0],
                time: mainNode?.innerHTML.split('时间限制: </span>')[1].split('&nbsp;')[0].split('<br>')[0],
                memory: mainNode?.innerHTML.split('内存限制: </span>')[1].split('&nbsp;')[0].split('<br>')[0],
            },
        }
    }

    async getSolution(contestId: number, problemId: number) {
        const response = await this.get('/problem_solution.php')
            .query({ cid: contestId, pid: problemId })
        const { window: { document } } = new JSDOM(response.text)
        const imgs = document.querySelectorAll('img')
        for (let img of imgs) {
            const src = img.getAttribute('src') as string
            const url = new URL(src, this.endPoint).href
            img.setAttribute('src', url)
        }
        const links = document.querySelectorAll('a')
        for (let link of links) {
            const src = link.getAttribute('href') as string
            const url = new URL(src, this.endPoint).href
            link.setAttribute('href', url)
        }
        return convertHTML(document.querySelector('.content.lang_cn') as Element)
    }

    async getCode(contestId: number, problemId: number) {
        const response = await this.get('/problem_std.php')
            .query({ cid: contestId, pid: problemId })
        const { window: { document } } = new JSDOM(response.text)
        return `// XMOJ, Contest ${contestId}, problem ${problemId}, standard code\n`
            + (document.querySelector('.jumbotron > pre')?.textContent || '')
    }

    async getRecords(problemId: number) {
        const response = await this.get('/status.php')
            .query({ problem_id: problemId, user_id: this.username })
        const { window: { document } } = new JSDOM(response.text)
        const recordNodes = document.querySelectorAll('#result-tab > tbody > tr')
        let records = []
        for (let recordNode of recordNodes) {
            records.push(+(recordNode.querySelector('td:nth-child(2)')?.textContent as string))
        }
        return records
    }
    async getRecord(contestId: number, problemId: number, record: number) {
        const response = await this.get('/showsource.php').query({ id: record })
        const { window: { document } } = new JSDOM(response.text)
        const code = document.querySelector('.jumbotron > pre')?.textContent || ''
        const accepted = code.split('/' + '*'.repeat(60)).pop()?.includes('Result: 正确')
        return {
            code: `// XMOJ, Contest ${contestId}, problem ${problemId}, `
                + `record ${record}, ${accepted ? 'should AC' : 'shouldn\'t AC'}\n` + code,
            accepted,
        }
    }
}
