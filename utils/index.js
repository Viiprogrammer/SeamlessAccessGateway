import tls from "node:tls"

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
