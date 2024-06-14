import tls from "tls"
import karmaChromeLauncher from "karma-chrome-launcher"

export function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }

    return array
}

export function patchTLSFingerprint() {
    // tls.DEFAULT_MIN_VERSION = 'TLSv1.2';
    // tls.DEFAULT_MAX_VERSION = 'TLSv1.3';

    const origTLSConnect = tls.connect
    const defaultCiphers = tls.DEFAULT_CIPHERS.split(':');
    const ciphers = [
        defaultCiphers[0],
        defaultCiphers[2],
        ...defaultCiphers.slice(6),
        defaultCiphers[1],
    ].join(':')

    tls.connect = function () {
        const args = arguments

        if (typeof args[0] === 'object') {
            args[0].ciphers = ciphers
        }

        // args[1].ciphers = ciphers
        return origTLSConnect(...args)
    }
}

export function getDomain(url, subdomain) {
    subdomain = subdomain || false;
    url = url.replace(/(https?:\/\/)?(www.)?/i, '');

    if (!subdomain) {
        url = url.split('.');
        url = url.slice(url.length - 2).join('.');
    }

    if (url.indexOf('/') !== -1) {
        return url.split('/')[0];
    }

    return url;
}

export async function fetchWithRetry (url, opts = {}) {
    let { pause, retry = 3, timeout = 3000, callback, silent = false } = opts

    while (retry > 0) {
        try {
            opts.signal = AbortSignal.timeout(timeout)
            const response = await fetch(url, opts)

            if (response.status >= 500 && response.status < 600) {
                throw new Error('Request failed with status code ' + response.status)
            } else {
                return response
            }
        } catch (err) {
            if (callback) callback(retry)

            retry = retry - 1

            if (retry === 0) {
                throw err
            }

            if (pause) {
                if (!silent) console.log("pausing..")
                await sleep(pause)
                if (!silent) console.log("done pausing...")
            }
        }
    }
}

export function makeHeadersLowercase (headers) {
    return Object.fromEntries(
        Object.entries(headers)
            .map(([key, value]) => [key.toLowerCase(), value])
    )
}

/**
 * Returns chrome paths
 * @return {{ chrome: string|null, chromeCanary: string|null, chromium: string|null }}
 */
export function findChrome () {
    const paths = {}

    for (const end of ['hrome', 'hromeCanary', 'hromium']) {
        paths[`c${end}`] = karmaChromeLauncher[`launcher:C${end}`][1].prototype.DEFAULT_CMD[process.platform] || null
    }

    return paths
}

export function sleep (ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}
