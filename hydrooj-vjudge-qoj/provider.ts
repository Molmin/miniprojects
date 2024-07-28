/* eslint-disable no-await-in-loop */
import { PassThrough } from 'stream';
import { JSDOM } from 'jsdom';
import { BasicFetcher, IBasicProvider, RemoteAccount } from '@hydrooj/vjudge';
import {
    Logger, parseMemoryMB, parseTimeMS, sleep, STATUS,
} from 'hydrooj';

const logger = new Logger('remote/qoj');
const MAPPING = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
};

export default class QOJProvider extends BasicFetcher implements IBasicProvider {
    constructor(public account: RemoteAccount, private save: (data: any) => Promise<void>) {
        super(account, 'https://qoj.ac', 'form', logger);
    }

    csrf: string;

    async getCsrfToken(url: string) {
        const { text: html, header } = await this.get(url);
        if (header['set-cookie']) await this.setCookie(header['set-cookie'], true);
        let value = /_token *: *"(.+?)"/g.exec(html);
        if (value) return value[1];
        value = /_token" value="(.+?)"/g.exec(html);
        return value?.[1];
    }

    get loggedIn() {
        return this.get('/login').then(({ text: html }) => !html.includes('<title>Login - QOJ.ac</title>'));
    }

    async ensureLogin() {
        if (await this.loggedIn) return true;
        logger.info('retry login');
        const _token = await this.getCsrfToken('/login');
        const { header, text } = await this.post('/login')
            .send({
                _token,
                login: '',
                username: this.account.handle,
                // NOTE: you should pass a pre-hashed key!
                password: this.account.password,
            });
        if (header['set-cookie'] && this.cookie.length === 1) {
            const cookie = Array.isArray(header['set-cookie']) ? header['set-cookie'] : [header['set-cookie']];
            cookie.push(...this.cookie);
            await this.save({ cookie });
            this.cookie = cookie;
        }
        if (text === 'ok') return true;
        return text;
    }

    async getProblem(id: string) {
        if (id === 'P0') return null;
        logger.info(id);
        const res = await this.get(`/problem/${id.split('P')[1]}`);
        const { window: { document } } = new JSDOM(res.text);
        const limits = Array.from(document.querySelectorAll('span.badge.badge-secondary.mr-1')).map((ele) => ele.textContent.trim());
        const timeLimitElement = limits.find((limit) => limit.startsWith('Time Limit:'));
        const timeLimit = timeLimitElement ? timeLimitElement.split('\n')[1].trim().split(' ')[0] : '1';
        const memoryLimitElement = limits.find((limit) => limit.startsWith('Memory Limit:'));
        const memoryLimit = memoryLimitElement ? memoryLimitElement.split('\n')[1].trim().split(' ')[0] : '256';
        const files = {};
        for (const ele of document.querySelectorAll('article>img[src]')) {
            const src = ele.getAttribute('src');
            if (!src.startsWith('http')) continue;
            const file = new PassThrough();
            this.get(src).pipe(file);
            const fid = String.random(8);
            files[`${fid}.png`] = file;
            ele.setAttribute('src', `file://${fid}.png`);
        }
        const contentNode = document.querySelector('article');
        const titles = contentNode.querySelectorAll('h3');
        for (const title of titles) {
            const ele = document.createElement('h2');
            ele.innerHTML = title.innerHTML;
            title.replaceWith(ele);
        }
        const expls = contentNode.querySelectorAll('h4');
        for (const expl of expls) {
            if (expl.innerHTML.trim() === 'explanation') expl.remove();
        }
        const pres = contentNode.querySelectorAll('pre');
        let lastId = 0;
        for (const pre of pres) {
            const before = pre.previousElementSibling;
            if (!before) continue;
            if (before.textContent === 'input') {
                const tid = before.previousElementSibling;
                if ((tid.textContent).startsWith('样例')) {
                    lastId = MAPPING[tid.textContent.split('样例')[1]];
                    tid.remove();
                }
            } else if (before.textContent !== 'output') continue;
            before.remove();
            const elePre = document.createElement('pre');
            const eleCode = document.createElement('code');
            elePre.appendChild(eleCode);
            eleCode.setAttribute('class', `language-${before.textContent}${lastId}`);
            eleCode.innerHTML = `${pre.innerHTML.trim()}\n`;
            pre.replaceWith(elePre);
        }
        const download = document.querySelector('.glyphicon-download-alt');
        if (download) {
            const file = new PassThrough();
            this.get(download.parentElement.getAttribute('href')).pipe(file);
            files['attachment.zip'] = file;
        }
        const links = contentNode.querySelectorAll('a');
        for (const link of links) {
            if (!link.href.startsWith('/download.php')) continue;
            link.setAttribute('href', 'file://attachment.zip');
        }
        let content = contentNode.innerHTML.trim();
        if (document.querySelector('iframe#statements-pdf')) {
            const file = new PassThrough();
            this.get('/download.php').query({ type: 'statement', id: id.split('P')[1] }).pipe(file);
            files['statement.pdf'] = file;
            content += '\n\n@[pdf](file://statement.pdf)';
        }
        return {
            title: document.querySelector('.page-header.text-center').textContent.trim().split('\n')[2].trim(),
            data: {
                'config.yaml': Buffer.from(`time: ${timeLimit}s\nmemory: ${memoryLimit}m\ntype: remote_judge\nsubType: qoj\ntarget: ${id}`),
            },
            files,
            tag: [],
            content: content.trim(),
        };
    }

    async listProblem(page: number, resync = false) {
        if (resync && page > 1) return [];
        const { text } = await this.get('/problems').query({ page });
        const { window: { document } } = new JSDOM(text);
        const eles = Array.from(document.querySelectorAll('div.table-responsive>table>tbody>tr>td:first-child'));
        const pids = eles.map((i) => i.textContent.replace(/^#/, 'P'));
        return pids.length > 0 ? pids : ['P0'];
    }

    async submitProblem(id: string, lang: string, code: string) {
        const programTypeId = lang.includes('qoj.') ? lang.split('qoj.')[1] : 'C++14';
        const _token = await this.getCsrfToken(`/problem/${id.split('P')[1]}`);
        const { text } = await this.post(`/problem/${id.split('P')[1]}`).send({
            _token,
            answer_answer_language: programTypeId,
            answer_answer_upload_type: 'editor',
            answer_answer_editor: code,
            'submit-answer': 'answer',
        });
        if (!text.includes('<title>Submissions - QOJ.ac</title>')) throw new Error('Submit fail');
        const { text: status } = await this.get(`/submissions?problem_id=${id.split('P')[1]}&submitter=${this.account.handle}`);
        const $dom = new JSDOM(status);
        return $dom.window.document.querySelector('tbody>tr>td>a').innerHTML.split('#')[1];
    }

    // eslint-disable-next-line consistent-return
    async waitForSubmission(id: string, next, end) {
        let count = 0;
        // eslint-disable-next-line no-constant-condition
        while (count < 120) {
            count++;
            await sleep(3000);
            const { text } = await this.get(`/submission/${id}`);
            const { window: { document } } = new JSDOM(text);
            if (text.includes('Compile Error')) {
                await next({ compilerText: document.querySelector('.uoj-content > .card:last-child > .card-body > pre').textContent });
                return await end({
                    status: STATUS.STATUS_COMPILE_ERROR, score: 0, time: 0, memory: 0,
                });
            }
            const summary = document.querySelector('tbody>tr');
            if (!summary) continue;
            let time = 0;
            let memory = 0;
            try {
                time = parseTimeMS(summary.children[4].innerHTML);
            } catch (e) { }
            try {
                memory = parseMemoryMB(summary.children[5].innerHTML) * 1024;
            } catch (e) { }
            if (document.querySelector('tbody').innerHTML.includes('Judging')) {
                await next({ status: STATUS.STATUS_JUDGING });
                continue;
            }
            // eslint-disable-next-line no-unsafe-optional-chaining
            const score = +document.querySelector('.uoj-score').getAttribute('data-score') || 0;
            const fullScore = +document.querySelector('.uoj-score').getAttribute('data-full') || 0;
            const status = score === fullScore ? STATUS.STATUS_ACCEPTED : STATUS.STATUS_WRONG_ANSWER;
            return await end({
                status,
                score,
                time,
                memory,
            });
        }
    }
}
