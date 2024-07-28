import { Context } from 'hydrooj';
import provider from './provider';

export function apply(ctx: Context) {
    ctx.inject(['vjudge'], async (c) => {
        c.vjudge.addProvider('qoj', provider);
    });
}
