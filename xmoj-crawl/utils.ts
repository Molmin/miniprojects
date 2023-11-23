export function convert(content: string) {
    return content.replace(/\r/g, '').trim()
        .split('\n').map(x => x.trim()).join('\n')
}

export function convertHTML(content: Element) {
    return content.innerHTML
}