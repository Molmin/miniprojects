import {
    Handler, Context, ObjectId, UserModel, MessageModel,
    param, Types, PRIV, PERM, db, Time, ForbiddenError, fs
} from 'hydrooj';

var list = {};
for (var type of ['B', 'P', 'CF', 'AT', 'UVA', 'SP'])
    list = Object.assign(list, JSON.parse(fs.readFileSync(`/home/noilinux/下载/problems-getter/data/luogu.${type}/list.json`)));

class SolutionMainHandler extends Handler {
    @param('page', Types.PositiveInt, true)
    async get(domainId: string, page = 1) {
        var total = 0; const perpage = 50, sols = new Array();
        for (var key in list) {
            if (total >= (page - 1) * perpage && total < page * perpage)
                list[key].pid = key, sols.push(list[key]);
            total++;
        }
        this.response.template = 'solution_main.html';
        this.response.body = { sols, ppcount: Math.ceil(total / perpage), page };
    }
}

class SolutionDetailHandler extends Handler {
    @param('solutionId', Types.String, true)
    async get(domainId: string, solutionId: string) {
        var errored = false;
        console.log(this.request.ip, solutionId);
        if (!fs.existsSync(`/home/noilinux/下载/luogu-solutions-getter/solutions/${solutionId}`)
            || !list[solutionId]) errored = true
        var data = errored ? { count: 0, solutions: new Array() } :
            JSON.parse(fs.readFileSync(`/home/noilinux/下载/luogu-solutions-getter/solutions/${solutionId}/main.json`, 'utf8'));
        data.solutions.forEach(sol => {
            sol.style = {
                Gray: 'color: #BFBFBF;',
                Blue: 'color: #0E90D2;',
                Green: 'color: #5EB95E;',
                Orange: 'color: #E67E22; font-weight: bold;',
                Red: 'color: #E74C3C; font-weight: bold;',
                Purple: 'color: #8E44AD; font-weight: bold;'
            }[sol.color];
            sol.content = fs.readFileSync(`/home/noilinux/下载/luogu-solutions-getter/solutions/${solutionId}/${sol.uid}.md`, 'utf8');
        });
        this.response.template = 'solution_detail.html';
        this.response.body = { solutions: data.solutions };
    }
}

class BadgeMainHandler extends Handler {
    async get() {
        this.response.template = 'badge_main.html';
        this.response.body = {};
    }

    @param('uid', Types.Int)
    @param('badge', Types.String)
    async postUpdate(domainId: string, uid: number, badge: string) {
        const udoc = await UserModel.getById('system', uid);
        var success = false;
        if (udoc && /^.{1,10}#[0-9a-fA-F]{1,6}#[0-9a-fA-F]{1,6}$/.test(badge)) {
            UserModel.setById(uid, { badge });
            success = true;
        }
        this.response.body = { uid };
        this.response.redirect = success
            ? this.url('user_detail', { uid })
            : this.url('badge_main', {});
    }
}

export async function apply(ctx: Context) {
    ctx.inject('Nav', 'solution_main', { before: 'record_main', prefix: 'solution' });
    ctx.Route('solution_main', '/solution', SolutionMainHandler);
    ctx.Route('solution_detail', '/solution/:solutionId', SolutionDetailHandler/*, PRIV.PRIV_USER_PROFILE*/);
    ctx.i18n.load('zh', {
        solution_main: '题解列表',
        solution_detail: '题解',
    });
    ctx.i18n.load('en', {
        solution_main: 'Solutions',
        solution_detail: 'Solution',
    });

    ctx.Route('badge_main', '/badge', BadgeMainHandler, PRIV.PRIV_USER_PROFILE);
    const BOT_UID = 114514;
    ctx.on('user/message', async (to, mdoc) => {
        if (to != BOT_UID) return;
        var from_udoc = await UserModel.getById('system', mdoc.from);
        const udocs = await UserModel.getMulti({}).toArray();
        for (var udoc of udocs) {
            if (udoc._id <= 1 || udoc._id == BOT_UID || udoc._id == mdoc.from) continue;
            const msg = `${from_udoc.uname}\n${mdoc.content}`;
            await MessageModel.send(BOT_UID, udoc._id, msg,
                MessageModel.FLAG_RICHTEXT | MessageModel.FLAG_UNREAD);
        }
    });
}
