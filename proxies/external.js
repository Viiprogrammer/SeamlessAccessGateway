import { Proxy } from "http-mitm-proxy"
import {filterSocketConnReset, patchRequestHeaders} from "./shared.js";
import {spawn} from "node:child_process";
import {getDomain} from "../utils/index.js";

const externalProxy = new Proxy()
//externalProxy._onSocketError = () => {}
externalProxy.use(Proxy.gunzip)

function onRequestRewriteHeadersFactory (clearances) {
    return function(ctx, callback) {
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
        // const chunksRequest = []

        const chunks = []

        // ctx.onRequestData((ctx, chunk, callback) => {
        //     chunksRequest.push(chunk)
        //     callback(null, chunk)
        // })

        // ctx.onResponseEnd((ctx, callback) => {
        //     console.log(1111, Buffer.concat(chunksRequest).toString())
        //     callback()
        // })

        ctx.onResponseData(async (ctx, chunk, callback) => {
            if (chunk.toString().includes('Just a moment')) {
                console.log('Challenge found', ctx.clientToProxyRequest.headers.host)
                const challenge = { solved: false }
                if (!activeChallenges.has(ctx.clientToProxyRequest.headers.host)) {
                    challenge.promise = new Promise((resolve, reject) => {
                        challenge.resolve = resolve
                        challenge.reject = reject
                    })
                        .catch(() => { /* ignore */ })

                    activeChallenges.set(ctx.clientToProxyRequest.headers.host, challenge)

                    challenge.child = createWebview('https://' + ctx.clientToProxyRequest.headers.host)

                    challenge.closeWebview = () => {
                        challenge.child.kill('SIGINT')
                    }

                    challenge.child.on('exit', () => {
                        console.log('Challenge exited', ctx.clientToProxyRequest.headers.host)
                        if (!challenge.solved) {
                            challenge.reject(new Error('Challenge failed'))
                        } else {
                            console.warn('Challenge solved')
                            challenge.resolve()
                        }
                        activeChallenges.delete(ctx.clientToProxyRequest.headers.host)
                    })
                }
            }

            chunks.push(chunk)
            return callback(null, undefined) // don't write chunks to client response

            //return callback(null, chunk);
        })

        ctx.onResponseEnd(async (ctx, callback) => {
            let body = Buffer.concat(chunks);

            if (body.toString().includes('Just a moment')) {
                console.log('Pause request')
                const { host: challengeHost } = ctx.clientToProxyRequest.headers
                const activeCfChallenge = [...activeChallenges.entries()].find(([host]) => {
                    return getDomain(host) === getDomain(challengeHost)
                })

                await activeCfChallenge[1].promise

                await fetch(new URL(
                    ctx.clientToProxyRequest.url,
                    'https://' + ctx.clientToProxyRequest.headers.host
                ), {
                    method: ctx.clientToProxyRequest.method,
                    //body: Buffer.concat(chunksRequest),
                    headers: patchRequestHeaders(
                        ctx.clientToProxyRequest.headers,
                        clearances
                    ),
                }).then(async response => {
                    const body = await response.text()

                    ctx.proxyToClientResponse.write(body);
                    ctx.proxyToClientResponse.end();
                })

                return
            }


            ctx.proxyToClientResponse.write(body);
            return callback();
        });

        return callback()
    }
}

export function startExternalProxy ({ port, host, clearances, activeChallenges, createWebview }) {
    externalProxy.onRequest(onRequestRewriteHeadersFactory(clearances))

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
