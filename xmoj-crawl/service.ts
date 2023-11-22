import superagent from 'superagent'
import { JSDOM } from 'jsdom'
import crypto from 'node:crypto'

require('superagent-charset')(superagent)

declare module 'superagent' {
    interface Request {
        charset(c: string): this
    }
}

function md5(str: string) {
    const md5 = crypto.createHash('md5')
    const result = md5.update(str).digest('hex')
    return result
}

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
            .buffer(true)
            .charset('gbk')
    }
    post(url: string) {
        return superagent
            .post(this.endPoint + url)
            .set('Cookie', this.cookie)
    }

    async isLoggedIn(): Promise<boolean> {
        const response = await this.get('/template/bs3/profile.php')
        console.log(response.text)
        return false
    }

    async getCsrfToken(): Promise<string> {
        const { text } = await this.get('/csrf.php')
        const { window: { document } } = new JSDOM(text)
        return document.querySelector('input')?.value as string
    }

    async login() {
        console.log('Try login')
        const response = await this.get('/loginpage.php')
        this.cookie = response.header['set-cookie'].join('; ')
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
        await this.isLoggedIn()
        return false
    }
}
