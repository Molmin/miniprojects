import superagent from 'superagent'
import AdmZip from 'adm-zip'

const UA = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'AppleWebKit/537.36 (KHTML, like Gecko)',
    'Chrome/118.0.0.0 Safari/537.36 Edg/118.0.2088.76',
].join(' ')

export default class LuoguAccountService {
    constructor(
        private userId: number,
        private cookie: string,
        private endPoint = 'https://www.luogu.com.cn',
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
        const { body } = await this.get('/problem/list').query({ _contentOnly: true })
        return body.currentUser.uid === this.userId
    }

    async getProblem(pid: string) {
        const { body: { currentData: { problem } } } = await this
            .get(`/problem/${pid}`).query({ _contentOnly: true })
        let content = ''
        if (problem.background) content += `## 题目背景\n\n${problem.background}\n\n`
        if (problem.description) content += `## 题目描述\n\n${problem.description}\n\n`
        if (problem.inputFormat) content += `## 输入格式\n\n${problem.inputFormat}\n\n`
        if (problem.outputFormat) content += `## 输出格式\n\n${problem.outputFormat}\n\n`
        let id = 0
        for (const [input, output] of problem.samples) {
            id++
            content += `\`\`\`input${id}\n${input}\n\`\`\`\n\n`
            content += `\`\`\`output${id}\n${output}\n\`\`\`\n\n`
        }
        if (problem.hint) content += `## 提示\n\n${problem.hint}\n\n`
        return {
            title: problem.title,
            content: content.trim(),
            // limits:
        }
    }

    async getTestdata(pid: string) {
        const { body } = await this.get(`/fe/api/problem/generateDataDownloadLink/${pid}`)
        return new AdmZip(body)
    }

    async getRecords(pid: string) {
        let rids: number[] = []
        for (let page = 1; ; page++) {
            const { body: { currentData: { records: { result: records } } } } = await this
                .get('/record/list').query({ pid, page, _contentOnly: true })
            const ids = records.map((record: any) => record.id)
            if (ids.length === 0) return rids
            rids = rids.concat(ids)
        }
    }

    async getRecord(rid: number) {
        const { body: { currentData } } = await this
            .get(`/record/${rid}`).query({ _contentOnly: true })
        if (currentData.errorMessage) return null
        else return {
            code: currentData.record.sourceCode,
            score: currentData.record.score || 0,
        }
    }
}