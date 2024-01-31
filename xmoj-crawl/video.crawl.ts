import { createWriteStream, existsSync, readFileSync } from 'node:fs'
import superagent from 'superagent'
import { ensureDirSync } from "fs-extra"
import { JSDOM } from 'jsdom'
import XMOJAccountService from "./service"
import { getVideoUrl } from './video.api'
import { Queue } from './queue'

const config = JSON.parse(readFileSync('config.json').toString())

const xmoj = new XMOJAccountService(
    config.username,
    config.password,
)

const downloadQueue = new Queue(10)

async function downloadFile(link: string, target: string) {
    const request = superagent.get(link)
    const stream = createWriteStream(target)
    request.pipe(stream)
    await new Promise((resolve, reject) => {
        stream.on('finish', resolve)
        stream.on('error', reject)
        request.on('error', reject)
        request.on('timeout', reject)
    })
}

async function getVideos(contestId: number) {
    const response = await xmoj.get('/contest_video.php').query({ cid: contestId })
    const { window: { document } } = new JSDOM(response.text)
    const scripts: string[] = []
    for (const script of document.querySelectorAll('div.jumbotron > center > script')) {
        const str = script.innerHTML
        scripts.push(str)
    }
    return scripts
}

async function main() {
    ensureDirSync('data/video')
    if (!await xmoj.ensureLogin()) return console.error('Logged in failed')
    console.log('Logged in XMOJ')
    const contestIds = (await xmoj.getContests()).map((contest) => contest.contestId)
    const tasks = []
    for (const contestId of contestIds) {
        await new Promise((resolve) => setTimeout(resolve, 3000))
        const result = await xmoj.getContest(contestId)
        if (!result?.review) {
            console.log(`No review in contest ${contestId}`)
            continue
        }
        const scripts = await getVideos(contestId)
        console.log(`Found ${scripts.length} videos in contest ${contestId}`)
        for (let i = 0; i < scripts.length; i++) {
            tasks.push(downloadQueue.waitForTask(async () => {
                const target = `data/video/${contestId}${scripts.length <= 1 ? '' : `-${i + 1}`}.mp4`
                if (existsSync(target) && config.skipDownloadedVideo) return
                const script = (await getVideos(contestId))[i]
                let data
                try {
                    data = Object.fromEntries(script.split('new Aliplayer({')[1].split('}, function(player) {')[0]
                        .split('\n').map((x) => x.trim().split(',')[0]).filter((x) => x)
                        .map((x) => x.split(':')).map(([x, y]) => [x.trim(), JSON.parse(y.replace(/'/g, '"'))]))
                }
                catch (e) {
                    throw new Error(`Failed to parse video in contest ${contestId}`)
                }
                if (Object.entries(data).length != 10) throw new Error(`Found error in contest ${contestId}`)
                const url = getVideoUrl(data)
                const { body: video } = await superagent.get(url)
                console.log(`Start downloading contest ${contestId} video #${i + 1}`)
                await downloadFile(video.PlayInfoList.PlayInfo[0].PlayURL, target)
                console.log(`Downloaded contest ${contestId} video #${i + 1}`)
            }))
        }
    }
    await Promise.all(tasks)
    downloadQueue.close()
}

main()
