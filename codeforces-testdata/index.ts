import { ensureDirSync } from 'fs-extra'
import { readFileSync, writeFileSync } from 'node:fs'

ensureDirSync('data')

const data = JSON.parse(readFileSync('data.json').toString())

for (let i = 1; i <= 1000; i++) {
    if (!data[`input#${i}`] || !data[`answer#${i}`]) continue
    const prefix = data[`input#${i}`].trim().endsWith('...')
        || data[`answer#${i}`].trim().endsWith('...')
    writeFileSync(`data/${prefix ? '.' : ''}cf-${i}.in`, data[`input#${i}`])
    writeFileSync(`data/${prefix ? '.' : ''}cf-${i}.ans`, data[`answer#${i}`])
}