import { readFileSync } from 'node:fs'
import HydroAccountService from './basic/service'
import { SecretConfig } from './basic/secret'

console.log({
    JobConfigFile: process.argv[2] || 'job.json',
    SecretConfigFile: process.argv[3] || 'secret.json',
})

enum STATUS {
    STATUS_WAITING = 0,
    STATUS_ACCEPTED = 1,
    STATUS_WRONG_ANSWER = 2,
    STATUS_TIME_LIMIT_EXCEEDED = 3,
    STATUS_MEMORY_LIMIT_EXCEEDED = 4,
    STATUS_OUTPUT_LIMIT_EXCEEDED = 5,
    STATUS_RUNTIME_ERROR = 6,
    STATUS_COMPILE_ERROR = 7,
    STATUS_SYSTEM_ERROR = 8,
    STATUS_CANCELED = 9,
    STATUS_ETC = 10,
    STATUS_HACKED = 11,
    STATUS_JUDGING = 20,
    STATUS_COMPILING = 21,
    STATUS_FETCHED = 22,
    STATUS_IGNORED = 30,
    STATUS_FORMAT_ERROR = 31,
    STATUS_HACK_SUCCESSFUL = 32,
    STATUS_HACK_UNSUCCESSFUL = 33,
}

const secret = JSON.parse(readFileSync(process.argv[3] || 'secret.json').toString()) as SecretConfig

const service = new HydroAccountService(secret.endpoint)

async function main() {
    await service.login(secret.username, secret.password)
    const username = await service.getLoggedInUser()
    if (username === 'Guest') return console.error(`Not logged in`)
    console.log(`Logged in as user ${username}`)
    await service.connect()
    service.on((data) => {
        if (data.language) console.log('Load language')
        if (data.task) {
            console.log(`Handle task: record ${data.task.rid}`)
            const code = data.task.code
            function end(msg: any) {
                console.log(`End with data:`, msg)
                service.send({
                    key: 'end',
                    domainId: data.task.domainId,
                    rid: data.task.rid,
                    ...msg
                })
            }
            if (/^\/\/ Score: \d+?/.test(code)) {
                const match = /^\/\/ Score: (\d+)/.exec(code) as RegExpExecArray
                const score = +match[1]
                end({
                    status: score === 100 ? STATUS.STATUS_ACCEPTED : STATUS.STATUS_WRONG_ANSWER,
                    score,
                })
            }
            else {
                end({ status: STATUS.STATUS_SYSTEM_ERROR })
            }
        }
    })
}

main()