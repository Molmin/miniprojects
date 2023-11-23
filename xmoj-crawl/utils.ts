export function convert(content: string) {
    return content.replace(/\r/g, '').trim()
        .split('\n').map(x => x.trim()).join('\n')
}

export function convertHTML(content: Element) {
    let ret = ''
    for (let node of content.children) {
        const tagName = node.tagName.toLowerCase()
        if (tagName === 'p') ret += `${convert(node.innerHTML)}\n\n`
        if (tagName === 'table') {
            let rows = []
            for (let tr of node.querySelectorAll('tbody > tr')) {
                let row = '|'
                for (let td of tr.querySelectorAll('td'))
                    row += ` ${convert(td.textContent as string)} |`
                rows.push(row)
                if (rows.length === 1) {
                    rows.push('|' + ' :-: |'.repeat(tr.querySelectorAll('td').length))
                }
            }
            ret += rows.join('\n') + '\n\n'
        }
        if (tagName === 'img') {
            ret += `![${node.getAttribute('alt')}](${node.getAttribute('src')})\n\n`
        }
        if (tagName === 'a') {
            ret += `[${node.innerHTML}](${node.getAttribute('href')})\n\n`
        }
        if (tagName === 'pre') {
            ret += `\`\`\`\n${convert(node.innerHTML)}\`\`\`\n\n`
        }
        if (tagName === 'strong') {
            ret += `**${convert(node.innerHTML)}**\n\n`
        }
        if (tagName === 'ul' || tagName === 'ol') {
            const li = node.querySelectorAll('li')
            let id = 0
            for (let l of li) {
                id++
                ret += `${tagName === 'ol' ? `${id}.` : '-'} ${convert(l.innerHTML)}\n`
            }
            ret += '\n'
        }
    }
    return ret
}