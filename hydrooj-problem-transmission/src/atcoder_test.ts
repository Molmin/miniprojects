import HydroAccountService from './basic/service'

const service = new HydroAccountService(
    'https://hydro.ac', '', 'atcoder',
)

async function main() {
    let countPages = 1, list: string[] = []
    for (let page = 1; page <= countPages; page++) {
        console.log(`Getting page ${page} / ${countPages}`)
        let { body: { ppcount, pdocs } } = await service.get('/p').query({ page })
        countPages = ppcount
        pdocs = pdocs.filter((pdoc: any) => pdoc.nSubmit > 0 && pdoc.nAccept === 0)
        pdocs = pdocs.map((pdoc: { pid: string }) => pdoc.pid) as string[]
        list = list.concat(pdocs)
    }
    console.log(list.join('\n'))
    console.log(list.length)
}

main()