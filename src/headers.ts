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

export function getHeaderValue(headers: IncomingHttpHeaders | OutgoingHttpHeaders, name: string): string | undefined {
    const normalizedName = name.toLowerCase()
    const headerName = Object.keys(headers).find((candidate) => {
        return candidate.toLowerCase() === normalizedName
    })

    if (!headerName) {
        return undefined
    }

    const headerValue = headers[headerName]

    if (Array.isArray(headerValue)) {
        return headerValue[0]
    }

    return headerValue?.toString()
}

export function getFilteredHeaders<Headers extends IncomingHttpHeaders | OutgoingHttpHeaders>(headers: Headers): Headers {
    const filteredHeaders = { ...headers }

    Object.keys(filteredHeaders).forEach((key) => {
        if (filteredHeaderNames.includes(key.toLowerCase())) {
            delete filteredHeaders[key]
        }
    })

    return filteredHeaders
}
