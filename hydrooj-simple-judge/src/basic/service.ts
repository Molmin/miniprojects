import superagent from 'superagent'
import WebSocket from 'ws'

export default class HydroAccountService {
    public uid = 0
    public cookie = ''
    public sid = ''
    socket?: WebSocket
    constructor(public endpoint: string) { }

    get(url: string) {
        return superagent
            .get(this.endpoint + url)
            .set('Cookie', this.cookie)
            .accept('application/json')
    }
    post(url: string) {
        return superagent
            .post(this.endpoint + url)
            .set('Cookie', this.cookie)
            .accept('application/json')
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
            .send({ uname, password, rememberme: true })
        this.cookie = response.header['set-cookie']
        this.sid = response.header['set-cookie'][0].split('=')[1].split(';')[0]
    }

    connect() {
        this.socket = new WebSocket(this.endpoint.replace('http', 'ws') + '/judge/conn', {
            headers: { Authorization: `Bearer ${this.sid}` },
        });
        return new Promise((resolve) => {
            this.socket?.once('open', () => {
                console.log('Connected')
                setInterval(() => this.send({ key: 'ping' }), 30 * 1000)
                resolve(null)
            })
        })
    }
    send(message: any) {
        this.socket?.send(typeof message === 'string' ? message : JSON.stringify(message));
    }
    on(func: (msg: any) => any) {
        this.socket?.on('message', (data) => {
            const msg = JSON.parse(data.toString())
            func(msg)
        })
    }
}
