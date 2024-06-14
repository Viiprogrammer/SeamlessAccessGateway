import { patchTLSFingerprint } from "./utils/index.js";
patchTLSFingerprint()

import { spawn } from "node:child_process"
import { startExternalProxy } from "./proxies/index.js";
import { startInternalProxy } from "./proxies/internal.js";
import { PersistentMap } from "./utils/persistent-map.js";

const activeChallenges = new Map()
const clearances = new PersistentMap([], 'clearances.json')
//global.clearances = clearances
//console.error = () => {}

function createWebviewFactory (proxy) {
    return (url) => {
        return spawn(/*'./webview'*/'google-chrome-stable', [
            '--app=' + url,
            '--proxy-server=http://'+ proxy.host + ':' + proxy.port,
            '--ignore-certificate-errors',
            '--window-size=800,600',
            '--disable-sync',
            '--chrome-frame'
        ], {
            env: {
                ...process.env,
                HTTP_PROXY: 'http://'+ proxy.host + ':' + proxy.port
            }
        })
    }
}

async function main() {
    const { default: getPort } = await import('get-port')
    const { default: chalk } = await import('chalk')

    const internalHost = 'localhost'
    const externalHost = 'localhost'
    const externalPort = await getPort({ port: [5191, 5192, 5193, 5194, 5195] })
    const internalPort = await getPort()


    startInternalProxy({
        port: internalPort,
        host: internalHost,
        activeChallenges,
        clearances
    })

    startExternalProxy({
      port: externalPort,
      host: externalHost,
      activeChallenges,
      clearances,
      createWebview: createWebviewFactory({
        port: internalPort,
        host: internalHost
      })
    })

    console.log(chalk.yellow('Proxy listening on port'), chalk.red(internalPort))
    console.log(chalk.blue('External proxy listening on port: ') + chalk.green(externalPort))
}

main()
