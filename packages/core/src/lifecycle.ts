// Process lifecycle management: background workers and graceful shutdown.
// WARNING: importing this module registers system signal handlers.
// Include it only at the application's entry point, when this behavior is needed.

import {EventEmitter} from "node:events";

import MPeriods from "./tools/MPeriods.js";

const events = new EventEmitter()
const processes: Promise<void>[] = []
let resolvePromise: (value?: unknown) => void
export const stopPromise = new Promise(resolve => resolvePromise = resolve)

process.setMaxListeners(0)
process.on('SIGHUP', stopServer);
process.on('SIGUSR2', stopServer);
process.on('SIGINT', stopServer);
process.on('SIGTERM', stopServer);
process.on('close', stopServer);

let stopped = false

export function isStopped() {
    return stopped
}

export function waitProcesses() {
    return Promise.all(processes)
}

export function makeProcess(name: string, worker: () => Promise<void>, period: number, critical = false, delayed = false) {
    let firstResolve
    let firstReject
    console.log('make process', name, period, critical, delayed);
    const promise = new Promise((resolve, reject) => {
        firstResolve = resolve
        firstReject = reject
    })

    if (delayed) {
        processes.push(cancelableTimeout(period).then(() => {
            return contextProcess(name, worker, period, critical, firstResolve, firstReject)
        }))
    } else {
        processes.push(
            contextProcess(name, worker, period, critical, firstResolve, firstReject)
        )
    }
    return promise
}

export async function contextProcess(name: string, worker: () => Promise<void>, period: number, critical = false, firstResolve?, firstReject?) {
    const start = Date.now() / 1000
    try {
        await worker().then(firstResolve).catch(e => {
            if (firstReject) {
                firstReject(e)
            }
            return Promise.reject(e)
        });
    } catch (e) {
        console.error(Date.now() / 1000 - start, name, critical, e)
        if (critical) {
            throw e
        }
    }
    if (await cancelableTimeout(period)) {
        return contextProcess(name, worker, period, critical)
    }
    console.log('process', name, 'stopped')
}

export function cancelableTimeout(timeout: number) {
    if (isStopped()) {
        return Promise.resolve(false)
    }
    return new Promise(resolve => {
        const timeouter = setTimeout(() => {
            events.off('stop', onStop)
            resolve(true)
        }, timeout)
        const onStop = () => {
            clearTimeout(timeouter)
            resolve(false)
        }
        events.once('stop', onStop)
    })
}

export function timeout(timeout: number) {
    return new Promise(resolve => setTimeout(resolve, timeout))
}

export function stopServer(event, timeout = MPeriods.Second * 20) {
    console.log(process.pid, 'receive signal', event, 'stopping...')
    stopped = true
    resolvePromise()
    events.emit('stop')
    if (timeout) {
        setTimeout(() => process.exit(), timeout)
    }
}
