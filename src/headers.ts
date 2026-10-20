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

export function getHeaderValue(headers: IncomingHttpHeaders | OutgoingHttpHeaders, headerName: string): string | undefined {
    const normalizedHeaderName = headerName.toLowerCase()
    const matchingHeaderName = Object.keys(headers).find((candidate) => {
        return candidate.toLowerCase() === normalizedHeaderName
    })

    if (!matchingHeaderName) {
        return undefined
    }

    const headerValue = headers[matchingHeaderName]

    if (Array.isArray(headerValue)) {
        return headerValue[0]
    }

    return headerValue?.toString()
}

export function filterHeaders<Headers extends IncomingHttpHeaders | OutgoingHttpHeaders>(headers: Headers): Headers {
    const filteredHeaders = { ...headers }

    Object.keys(filteredHeaders).forEach((key) => {
        if (filteredHeaderNames.includes(key.toLowerCase())) {
            delete filteredHeaders[key]
        }
    })

    return filteredHeaders
}
