// Since node 0.9.9, ECONNRESET on sockets are no longer hidden
import {getDomain} from "../utils/index.js";

export function filterSocketConnReset(err, socketDescription) {
    if (err.errno === "ECONNRESET") {
        //console.log(`Got ECONNRESET on ${socketDescription}, ignoring.`);
    } else {
        // console.log(`Got unexpected error on ${socketDescription}`, err);
    }
}

export function patchRequestHeaders (headers, clearances) {
    const lowercaseHeaders = Object.fromEntries(
        Object.entries(headers)
            .map(([key, value]) => [key.toLowerCase(), value])
    )

    const { host: reqHost } = headers

    const findCfClearance = [...clearances.entries()].find(([host, value]) => {
        // console.log(host, new RegExp('csgo.com$', 'i').test(host))
        //return new RegExp(reqHost + '$', 'i').test(host)
        return getDomain(reqHost) === getDomain(host)
    })

    if (findCfClearance) {
        lowercaseHeaders['user-agent'] = findCfClearance[1]['user-agent']
        if (!lowercaseHeaders.cookie) {
            lowercaseHeaders.cookie = 'cf_clearance=' + findCfClearance[1].value
        } else {
            lowercaseHeaders.cookie += '; cf_clearance=' + findCfClearance[1].value
        }

        console.warn('Clearance found for site ' + reqHost)
    }

    return lowercaseHeaders
}
