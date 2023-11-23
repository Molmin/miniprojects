export interface XMOJContest {
    contestId: number
    title: string
}

export interface XMOJContestDetail {
    contestId: number
    title: string
    date: string
    problems: {
        title: string
        problemId: number
        haveSolution: boolean
        haveStandardCode: boolean
    }[]
}

export interface XMOJProblemDetail {
    problemId: number
    title: string
    content: string
    judge: {
        input: string
        output: string
        time: string
        memory: string
    }
}