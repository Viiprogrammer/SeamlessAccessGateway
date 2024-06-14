import { spawn } from "node:child_process"
import { findChrome, patchTLSFingerprint } from "./utils/index.js"
patchTLSFingerprint()

import { startExternalProxy } from "./proxies/index.js"
import { startInternalProxy } from "./proxies/internal.js"
import { PersistentMap } from "./utils/persistent-map.js"
import getPort from 'get-port'
import chalk from 'chalk'

const activeChallenges = new Map()
const clearances = new PersistentMap([], 'clearances.json')
//global.clearances = clearances
//console.error = () => {}

function createWebviewFactory (proxy) {
    return (url) => {
        const chromePaths = Object.values(findChrome())
            .filter(x => x !== null)

        const chromeArgs = [
            '--proxy-server=http://'+ proxy.host + ':' + proxy.port,
            '--ignore-certificate-errors',
            '--window-size=800,600',
            '--disable-features=Translate',
            '--no-default-browser-check',
            '--noerrdialogs',
            '--incognito',
            '--disable-sync',
            '--disable-infobars',
            '--test-type',
            '--chrome-frame'
        ]

        return spawn(chromePaths[0] || './webview'/*'google-chrome-stable'*/, [
            '--app=' + url,
            ...(chromePaths[0] ? chromeArgs : [])
        ], {
            env: {
                ...process.env,
                HTTP_PROXY: 'http://'+ proxy.host + ':' + proxy.port
            }
        })
    }
}

async function main() {
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
