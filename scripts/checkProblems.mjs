import fs from 'node:fs'

fs.writeFileSync(
    'hydrooj-problem-transmission/secret.json',
    JSON.stringify(
        {
            oj_url: "https://hydro.ac",
            username: process.env.HYDRO_USERNAME,
            password: process.env.HYDRO_PASSWORD,
            domain: "milmon",
        },
        null, '  ',
    ),
)