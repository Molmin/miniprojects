export class Queue {
    concurrency = 1
    running = 0
    closed = false
    tasks: Array<() => void> = []
    constructor(concurrency = 1) {
        this.concurrency = concurrency
        this.start()
    }

    async start() {
        while (true) {
            await new Promise((resolve) => setTimeout(resolve, 10))
            if (this.closed) break
            while (this.running < this.concurrency && this.tasks.length > 0) {
                (this.tasks.shift() || (() => { }))()
                this.running++
            }
        }
    }

    async waitForTask(task: () => Promise<any>) {
        await new Promise((resolve) => this.tasks.push(() => resolve(null)))
        await task()
        this.running--
    }
    
    close() { this.closed = true }
}