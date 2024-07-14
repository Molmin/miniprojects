/* eslint-disable no-await-in-loop */
import {
    Context, DomainModel, NotFoundError,
    PERM, PermissionError, ProblemModel,
    ProblemNotFoundError, UserModel,
} from 'hydrooj';

async function postCopy({ domainId, target }) {
    if (this.pdoc.reference) {
        const { reference } = this.pdoc;
        const ddoc = await DomainModel.get(target);
        if (!ddoc) throw new NotFoundError(target);
        const ddoc_reference = await DomainModel.get(reference.domainId);
        if (!ddoc_reference) throw new NotFoundError(reference.domainId);
        const pdoc_reference = await ProblemModel.get(reference.domainId, reference.pid);
        if (!pdoc_reference) throw new ProblemNotFoundError(reference.domainId, reference.pid);

        // Confirm that both the source and target domains are allowed
        const t = `,${this.domain.share || ''},`;
        const t2 = `,${ddoc_reference.share || ''},`;
        if (t !== ',*,' && !t.includes(`,${target},`)) throw new PermissionError(target);
        if (t2 !== ',*,' && !t2.includes(`,${target},`)) throw new PermissionError(target);

        const dudoc = await UserModel.getById(target, this.user._id);
        if (!dudoc.hasPerm(PERM.PERM_CREATE_PROBLEM)) throw new PermissionError(PERM.PERM_CREATE_PROBLEM);

        const docId = await ProblemModel.copy(reference.domainId, pdoc_reference.docId, target);
        await ProblemModel.edit(target, docId, { content: this.pdoc.content });
        this.response.redirect = this.url('problem_detail', { domainId: target, pid: docId });
    } else {
        const t = `,${this.domain.share || ''},`;
        if (t !== ',*,' && !t.includes(`,${target},`)) throw new PermissionError(target);
        const ddoc = await DomainModel.get(target);
        if (!ddoc) throw new NotFoundError(target);
        const dudoc = await UserModel.getById(target, this.user._id);
        if (!dudoc.hasPerm(PERM.PERM_CREATE_PROBLEM)) throw new PermissionError(PERM.PERM_CREATE_PROBLEM);
        const docId = await ProblemModel.copy(domainId, this.pdoc.docId, target);
        this.response.redirect = this.url('problem_detail', { domainId: target, pid: docId });
    }
}

async function postCopyInList({ domainId, pids, target }) {
    const ddoc = await DomainModel.get(target);
    if (!ddoc) throw new NotFoundError(target);
    const t = `,${this.domain.share || ''},`;
    if (t !== ',*,' && !t.includes(`,${target},`)) throw new PermissionError(target);
    const dudoc = await UserModel.getById(target, this.user._id);
    if (!dudoc.hasPerm(PERM.PERM_CREATE_PROBLEM)) throw new PermissionError(PERM.PERM_CREATE_PROBLEM);

    const ids: number[] = [];
    for (const pid of pids) {
        const pdoc = await ProblemModel.get(domainId, pid);
        if (!pdoc) throw new NotFoundError(pid);
        if (pdoc.reference) {
            const { reference } = pdoc;
            const ddoc_reference = await DomainModel.get(reference.domainId);
            if (!ddoc_reference) throw new NotFoundError(reference.domainId);
            const pdoc_reference = await ProblemModel.get(reference.domainId, reference.pid);
            if (!pdoc_reference) throw new ProblemNotFoundError(reference.domainId, reference.pid);

            // Confirm that both the source and target domains are allowed
            const t2 = `,${ddoc_reference.share || ''},`;
            if (t2 !== ',*,' && !t2.includes(`,${target},`)) throw new PermissionError(target);

            const docId = await ProblemModel.copy(reference.domainId, pdoc_reference.docId, target);
            await ProblemModel.edit(target, docId, { content: pdoc.content });
            ids.push(docId);
        } else ids.push(await ProblemModel.copy(domainId, pdoc.docId, target));
    }
    this.response.body = ids;
}

export async function apply(ctx: Context) {
    ctx.withHandlerClass('ProblemDetailHandler', (h) => {
        h.prototype['postCopy'] = postCopy;
    });
    ctx.withHandlerClass('ProblemMainHandler', (h) => {
        h.prototype['postCopy'] = postCopyInList;
    });
}
