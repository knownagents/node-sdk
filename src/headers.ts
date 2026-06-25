import type { IncomingHttpHeaders, OutgoingHttpHeaders } from "http"

const filteredHeaderNames = [
    "authorization",
    "proxy-authorization",
    "cookie",
    "set-cookie",
    "x-api-key",
    "api-key",
    "apikey",
    "x-auth-token",
    "x-access-token",
    "x-id-token",
    "x-refresh-token",
    "x-session-token",
    "session-token",
    "csrf-token",
    "x-csrf-token",
    "xsrf-token",
    "x-xsrf-token",
    "x-amz-security-token",
    "x-goog-api-key",
    "x-client-secret",
    "client-secret",
    "private-token"
]

export function getFilteredHeaders<Headers extends IncomingHttpHeaders | OutgoingHttpHeaders>(headers: Headers): Headers {
    const filteredHeaders = { ...headers }

    Object.keys(filteredHeaders).forEach((key) => {
        if (filteredHeaderNames.includes(key.toLowerCase())) {
            delete filteredHeaders[key]
        }
    })

    return filteredHeaders
}

export function getIsMCPCall(headers: IncomingHttpHeaders): boolean {
    return Object.keys(headers).some((key) => {
        return key.toLowerCase() === "mcp-protocol-version"
    })
}

export function getIsUCPCall(headers: IncomingHttpHeaders): boolean {
    return Object.keys(headers).some((key) => {
        return key.toLowerCase() === "ucp-agent"
    })
}

export function getIsACPCall(headers: IncomingHttpHeaders): boolean {
    return !getIsUCPCall(headers) && Object.keys(headers).some((key) => {
        return key.toLowerCase() === "api-version"
    })
}
