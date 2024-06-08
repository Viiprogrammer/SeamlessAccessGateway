import { Proxy } from "http-mitm-proxy"
import { filterSocketConnReset } from "./shared.js";
import net from "node:net";
import {getDomain} from "../utils/index.js";

const proxy = new Proxy()
proxy.use(Proxy.gunzip);
//proxy._onSocketError = () => {}

// Bypass encrypted CF challenge request directly (because CF detects proxy in the middle, maybe it's slow)
function onConnect(req, socket, head, callback) {
    //console.log("CONNECT: " + req.url);

    const host = req.url.split(":")[0];
    const port = req.url.split(":")[1];

    // console.log('Tunnel to', req.url);

    if (req.url.startsWith('challenges')) {
        const conn = net.connect({
            port: port,
            host: host,
            allowHalfOpen: true
        }, function () {
            conn.on('finish', () => {
                socket.destroy()
            })

            socket.on("close", () => {
                conn.end()
            })

            conn.on("error", (err) => {
                filterSocketConnReset(err, "PROXY_TO_SERVER_SOCKET")
            });

            socket.on("error", (err) => {
                filterSocketConnReset(err, "CLIENT_TO_PROXY_SOCKET")
            })

            socket.write('HTTP/1.1 200 OK\r\n\r\n', 'utf8', function () {
                conn.pipe(socket)
                socket.pipe(conn)
            })
        });
    } else {
        callback(null, socket, head)
    }
}

function onResponseHeadersExtractClearanceFactory (clearances, activeChallenges) {
    return function (ctx, callback) {
        const lowercaseHeaders = Object.fromEntries(
            Object.entries(ctx.clientToProxyRequest.headers)
                .map(([key, value]) => [key.toLowerCase(), value])
        )

        if (lowercaseHeaders.cookie && lowercaseHeaders.cookie.includes('cf_clearance')) {
            const cookies = lowercaseHeaders.cookie.split(';')

            for (const cookie of cookies) {
                const [name, value] = cookie.split('=')

                if (name === 'cf_clearance') {
                    clearances.set(ctx.clientToProxyRequest.headers.host, {
                        value: value,
                        'user-agent': lowercaseHeaders['user-agent']
                    })

                    const { host: challengeHost } = ctx.clientToProxyRequest.headers
                    const activeCfChallenge = [...activeChallenges.entries()].find(([host]) => {
                        return getDomain(host) === getDomain(challengeHost)
                    })

                    if (activeCfChallenge) {
                        activeCfChallenge[1].solved = true
                        activeCfChallenge[1].closeWebview()
                    }

                    console.log('Clearance found', value)
                    //break
                }
            }
        }

        callback(null, ctx.clientToProxyRequest.headers)
    }
}

export function startInternalProxy ({ port, host, clearances, activeChallenges, createWebview }) {
    proxy.onConnect(onConnect)

    proxy.onResponseHeaders(onResponseHeadersExtractClearanceFactory(clearances, activeChallenges))

    proxy.onError((ctx, err) => {
        console.log('Proxy error', err)
    })

    proxy.listen({ port, host })
}
