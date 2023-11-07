import {
    Handler, Context, ObjectId,
    UserModel, TrainingModel, ProblemModel,
    param, Types, PRIV, PERM,
} from 'hydrooj'

class TrainingScoreboardHandler extends Handler {
    @param('tid', Types.ObjectId)
    async get(domainId: string, tid: ObjectId, uid = this.user._id) {
        const tdoc = await TrainingModel.get(domainId, tid)
        await this.ctx.parallel('training/get', tdoc, this)
        let enrollUsers: number[] = []
        const pids = TrainingModel.getPids(tdoc.dag)
        if (this.user.hasPriv(PRIV.PRIV_USER_PROFILE)) {
            enrollUsers = (await TrainingModel.getMultiStatus(domainId, { docId: tid, uid: { $gt: 1 } })
                .project({ uid: 1 }).limit(500).toArray()).map((x) => +x.uid)
        }
        else uid = this.user._id
        const canViewHidden = this.user.hasPerm(PERM.PERM_VIEW_PROBLEM_HIDDEN) || this.user._id
        const [udoc, udict, pdict, psdict] = await Promise.all([
            UserModel.getById(domainId, tdoc.owner),
            UserModel.getListForRender(domainId, enrollUsers),
            ProblemModel.getList(domainId, pids, canViewHidden, true),
            ProblemModel.getListStatus(domainId, enrollUsers, pids)
        ])
        var rows = new Array(), datas = new Array()
        enrollUsers.forEach(async (uid, uindex) => {
            datas.push(ProblemModel.getListStatus(domainId, uid, pids))
            rows.push([
                { type: 'rank', value: '0' },
                { type: 'user', raw: uid },
                { type: 'string', value: 0 }
            ])
            pids.forEach(pid =>
                rows[uindex].push({ type: 'record', score: 0, value: '', raw: undefined })
            )
        })
        datas = await Promise.all(datas)
        enrollUsers.forEach((uid, uindex) => {
            for (let pid in datas[uindex]) {
                if (pid.includes('#') || !datas[uindex][pid].rid) continue
                const record = datas[uindex][pid]
                let i = 0
                while (pids[i] != Number(pid)) i++
                rows[uindex][i + 3] = {
                    type: 'record', score: Number(record.score),
                    value: String(record.score), raw: record.rid,
                }
            }
            rows[uindex].forEach(record => {
                if (record.type == 'record')
                    rows[uindex][2].value += typeof record.score == 'number' ? record.score : 0
            })
        })
        rows.sort((x, y) => y[2].value - x[2].value)
        let lastScore = -1, rank = 1
        rows.forEach((row, index) => {
            if (row[2].value != lastScore)
                rank = index + 1, lastScore = row[2].value
            row[0].value = rank
        })
        rows.splice(0, 0, [
            { type: 'rank', value: '排名' },
            { type: 'user', value: '用户' },
            { type: 'total_score', value: '分数' }
        ])
        pids.forEach(pid =>
            rows[0].push({ type: 'problem', value: pdict[String(pid)].pid, raw: pid })
        )
        this.response.body = {
            tdoc, pids, pdict, psdict, udoc, udict, rows,
        }
        this.response.pjax = 'partials/training_scoreboard.html'
        this.response.template = 'training_scoreboard.html'
    }
}

export async function apply(ctx: Context) {
    ctx.Route('training_scoreboard', '/training/:tid/scoreboard', TrainingScoreboardHandler)

    ctx.i18n.load('zh', {
        training_scoreboard: '训练成绩表',
    })
    ctx.i18n.load('en', {
        training_scoreboard: 'Training Scoreboard',
    })
}
