import { Proxy } from "http-mitm-proxy"
import { patchRequestHeaders } from "./shared.js"
import { fetchWithRetry, getDomain } from "../utils/index.js"

const externalProxy = new Proxy()
//externalProxy._onSocketError = () => {}
externalProxy.use(Proxy.gunzip)

function onRequestRewriteHeadersFactory (clearances, activeChallenges) {
    return async function (ctx, callback) {
        // TODO: Add support for automatic retries for network errors on proxy layer
        // const chunksRequest = []
        //
        // ctx.onRequestData((ctx, chunk, callback) => {
        //     chunksRequest.push(chunk)
        //     callback(null, chunk)
        // })
        //
        // ctx.onRequestEnd(async (ctx, callback) => {
        //     const {method} = ctx.clientToProxyRequest
        //
        //     let requestBody
        //
        //     if (chunksRequest.length && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        //         requestBody = Buffer.concat(chunksRequest)
        //     }
        //
        //     const newHeaders = patchRequestHeaders(
        //         ctx.clientToProxyRequest.headers,
        //         clearances
        //     )
        //
        //     delete newHeaders['transfer-encoding']
        //
        //     try {
        //         const response = await fetchWithRetry(
        //             'https://' + ctx.clientToProxyRequest.headers.host + ctx.clientToProxyRequest.url, {
        //                 method,
        //                 body: requestBody/*requestBody ? Readable.from(requestBody) : undefined*/,
        //                 headers: newHeaders,
        //                 duplex: 'half',
        //                 pause: 1000
        //             })
        //
        //         if (response.headers.get('cf-mitigated') === 'challenge') {
        //             throw new Error('Request failed with status code ' + response.status);
        //         }
        //
        //         ctx.proxyToClientResponse.statusCode = response.status
        //
        //         const headersObject = Object.fromEntries(Array.from(response.headers.entries()));
        //
        //         for (const [key, value] of Object.entries(headersObject)) {
        //             // Remove content-encoding header, because we don't need it
        //             // (original content is compressed, but now it is not)
        //             if (key === 'content-encoding') {
        //                 continue
        //             }
        //
        //             ctx.proxyToClientResponse.setHeader(key, value);
        //         }
        //
        //         const data = await response.arrayBuffer()
        //
        //         ctx.proxyToClientResponse.end(Buffer.from(data))
        //     } catch (err) {
        //         callback()
        //     }
        // })
        //
        // callback()

        const { host: challengeHost } = ctx.clientToProxyRequest.headers
        const activeCfChallenge = [...activeChallenges.entries()].find(([host]) => {
            return getDomain(host) === getDomain(challengeHost)
        })

        if (activeCfChallenge) {
            console.log('wait for challenge')
            await activeCfChallenge[1].promise
        }

        ctx.proxyToServerRequestOptions.headers = patchRequestHeaders(
            ctx.proxyToServerRequestOptions.headers,
            clearances
        )
        console.log('Headers rewritten')
        callback()
    }
}

function onRequestFindSolveAndRetryChallengeRequestsFactory ({ activeChallenges, clearances, createWebview }) {
    return (ctx, callback) => {
        const chunksRequest = []

        ctx.onRequestData((ctx, chunk, callback) => {
            chunksRequest.push(chunk)
            callback(null, chunk)
        })

        ctx.onResponse(async (ctx, callback) => {
            // Pass through if not challenge
            if (ctx.serverToProxyResponse.headers['cf-mitigated'] !== 'challenge') {
                callback()
                return
            }

            // Challenge found
            const { headers: { host: serverHost }, method, url } = ctx.clientToProxyRequest

            console.log('Challenge found', serverHost)

            const challenge = { solved: false }

            if (!activeChallenges.has(serverHost)) {
                challenge.promise = new Promise((resolve, reject) => {
                    challenge.resolve = resolve
                    challenge.reject = reject
                })
                    .catch(() => { /* ignore */ })

                activeChallenges.set(serverHost, challenge)

                challenge.child = createWebview('https://' + serverHost)

                challenge.closeWebview = () => {
                    challenge.child.kill('SIGINT')
                }

                challenge.child.on('exit', () => {
                    console.log('Challenge exited', serverHost)
                    if (!challenge.solved) {
                        challenge.reject(new Error('Challenge failed'))
                    } else {
                        console.warn('Challenge solved')
                        challenge.resolve()
                    }
                    activeChallenges.delete(serverHost)
                })
            }

            await challenge.promise

            let requestBody

            if (chunksRequest.length && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
                requestBody = Buffer.concat(chunksRequest)
            }

            const newHeaders = patchRequestHeaders(
                ctx.clientToProxyRequest.headers,
                clearances
            )

            // Remove transfer-encoding header, because we don't need it
            // (original content is compressed, but now it is not)
            delete newHeaders['transfer-encoding']

            try {
                const response = await fetchWithRetry(
                    'https://' + serverHost + url, {
                        method,
                        body: requestBody,
                        headers: newHeaders,
                        duplex: 'half',
                        pause: 1000
                    })

                ctx.serverToProxyResponse.statusCode = response.status

                const headersObject = Object.fromEntries(Array.from(response.headers.entries()));

                for (const [key, value] of Object.entries(headersObject)) {
                    // Remove content-encoding header, because we don't need it
                    // (original content is compressed, but now it is not)
                    if (key === 'content-encoding') {
                        continue
                    }

                    ctx.proxyToClientResponse.setHeader(key, value);
                }

                ctx.proxyToClientResponse.end(
                    Buffer.from(
                        await response.arrayBuffer()
                    )
                )

                return
            } catch (e) {
                console.error('Error while retry after solving challenge', e)
                // Send original response without retrying
                callback()
            }
        })

        return callback()
    }
}

export function startExternalProxy ({ port, host, clearances, activeChallenges, createWebview }) {
    externalProxy.onRequest(onRequestRewriteHeadersFactory(clearances, activeChallenges))

    externalProxy.onRequest(onRequestFindSolveAndRetryChallengeRequestsFactory({
        activeChallenges,
        clearances,
        createWebview
    }))

    externalProxy.onError((ctx, err) => {
        console.log('Proxy error', err)
    })

    externalProxy.listen({ port, host })
}
