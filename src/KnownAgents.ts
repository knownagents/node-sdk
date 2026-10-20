import type { IncomingMessage, ServerResponse } from "http"
import { CLIENT_INFO_META_KEY, type Implementation } from "@modelcontextprotocol/server"
import { getFilteredHeaders } from "./headers"
import { getIsPathExcluded } from "./paths"
import type {
    AgentType,
    IdentificationRequest,
    IdentificationResult,
    KnownAgentsOptions,
    TrackVisitOptions,
    VisitRequest
} from "./types"

const DEFAULT_FLUSH_INTERVAL_IN_MILLISECONDS = 10000
const DEFAULT_FLUSH_QUEUE_SIZE = 1
const NODE_PACKAGE_VERSION = "3.0.0"

/**
 * Server-side client for Known Agents analytics, robots.txt generation, and agent identification.
 */
export class KnownAgents {
    private readonly accessToken: string
    private readonly flushIntervalInMilliseconds: number
    private readonly flushQueueSize: number
    private readonly visitQueue: VisitRequest[] = []
    private flushTimeout: NodeJS.Timeout | undefined
    private pendingFlushPromise: Promise<void> = Promise.resolve()

    /**
     * Creates a new instance of the Known Agents client.
     *
     * @param accessToken - Your project's access token.
     * @param options - Optional batching configuration.
     */
    constructor(accessToken: string, options: KnownAgentsOptions = {}) {
        this.accessToken = accessToken
        this.flushIntervalInMilliseconds = options.flushIntervalInMilliseconds ?? DEFAULT_FLUSH_INTERVAL_IN_MILLISECONDS
        this.flushQueueSize = options.flushQueueSize ?? DEFAULT_FLUSH_QUEUE_SIZE
    }

    /**
     * Tracks a single pageview or API call for analytics.
     * For Node.js responses, the visit is added to the visit event queue after the response finishes so status, headers, and duration are included.
     * This method is non-blocking and handles upload errors internally.
     *
     * @param request - The incoming HTTP request.
     * @param response - The outgoing HTTP response.
     * @param options - Optional protocol metadata.
     */
    trackVisit(request: IncomingMessage | Request, response?: ServerResponse | Response, options?: TrackVisitOptions): void {
        const url = request instanceof Request ? new URL(request.url) : undefined
        const requestHeaders = request instanceof Request ? Object.fromEntries(request.headers.entries()) : request.headers
        const path = url ? `${url.pathname}${url.search}` : request.url
        const method = request.method

        if (!path || getIsPathExcluded(path) || !method) {
            return
        }

        const created = new Date()

        const sendVisit = () => {
            const responseHeaders = response instanceof Response ? Object.fromEntries(response.headers.entries()) : response?.getHeaders() ?? {}
            const responseStatusCode = response instanceof Response ? response.status : response?.statusCode
            const responseDurationInMilliseconds = options?.responseDurationInMilliseconds ?? (!response || response instanceof Response ? undefined : Date.now() - created.getTime())
            const mcp = options?.mcp
            const clientInfo = (mcp?.context?.mcpReq.envelope as {
                [CLIENT_INFO_META_KEY]?: Implementation
            } | undefined)?.[CLIENT_INFO_META_KEY]

            const visitRequest: VisitRequest = {
                request_path: path,
                request_method: method,
                request_headers: requestHeaders,
                response_status_code: responseStatusCode,
                response_headers: responseHeaders,
                response_duration_in_milliseconds: responseDurationInMilliseconds,
                mcp_request_method: mcp?.context?.mcpReq.method,
                mcp_request_name: mcp?.toolName,
                mcp_request_client_info_name: clientInfo?.name,
                mcp_request_client_info_version: clientInfo?.version,
                mcp_response_result_is_error: mcp?.result?.isError,
                acp_response_body: options?.acp?.responseBody,
                ucp_response_body: options?.ucp?.responseBody,
                created: created.toISOString()
            }

            this.enqueueVisit(visitRequest)
        }

        if (!response || response instanceof Response) {
            sendVisit()
            return
        }

        if (response.writableEnded) {
            sendVisit()
        } else {
            response.once("finish", sendVisit)
        }
    }

    /**
     * Uploads all events currently in the visit event queue and waits for pending uploads to finish.
     * This method handles upload errors internally.
     *
     * @returns A promise that resolves after all pending upload attempts finish.
     */
    flush(): Promise<void> {
        if (this.flushTimeout) {
            clearTimeout(this.flushTimeout)
            this.flushTimeout = undefined
        }

        const requests = this.visitQueue.splice(0)

        if (requests.length === 0) {
            return this.pendingFlushPromise
        }

        this.pendingFlushPromise = this.pendingFlushPromise.then(() => {
            return this.sendVisits(requests)
        })

        return this.pendingFlushPromise
    }

    /**
     * Generates a robots.txt file that disallows the specified agent types.
     * The generated file stays up-to-date with all current and future agents in the specified categories.
     * Cache and serve the result at your website's `/robots.txt` endpoint.
     *
     * @param agentTypes - An array of agent types to disallow.
     * @param disallow - The path to disallow (default: "/" for all paths).
     * @returns A promise that resolves to the generated robots.txt content as a string.
     * @throws {Error} If the API call fails or returns a non-200 status.
     */
    async generateRobotsTXT(agentTypes: AgentType[], disallow: string = "/"): Promise<string> {
        const response = await fetch("https://api.knownagents.com/robots-txts", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${this.accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                agent_types: agentTypes,
                disallow: disallow,
                node_package_version: NODE_PACKAGE_VERSION
            })
        })

        if (response.ok) {
            return await response.text()
        } else {
            throw new Error(`Known Agents failed to generate robots.txt: ${response.status} ${response.statusText}`)
        }
    }

    /**
     * Identifies and verifies a single agent from an HTTP request.
     * Uses Web Bot Auth (HTTP message signatures), IP matching, or other available methods.
     *
     * @param request - The incoming Node.js HTTP request.
     * @returns A promise that resolves to the identification result.
     * @throws {Error} If the API call fails or returns a non-200 status.
     */
    async identifyAgent(request: IncomingMessage): Promise<IdentificationResult> {
        const response = await fetch("https://api.knownagents.com/agent-identifications", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${this.accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                request_headers: getFilteredHeaders(request.headers),
                request_ip: request.socket.remoteAddress,
                request_path: request.url,
                node_package_version: NODE_PACKAGE_VERSION
            })
        })

        if (response.ok) {
            return await response.json()
        } else {
            throw new Error(`Known Agents failed to identify agent: ${response.status} ${response.statusText}`)
        }
    }

    /**
     * Identifies and verifies multiple agents from HTTP requests in a batch.
     * Uses Web Bot Auth (HTTP message signatures), IP matching, or other available methods.
     *
     * @param requests - An array of identification requests.
     * @returns A promise that resolves to an array of identification results.
     * @throws {Error} If the API call fails or returns a non-200 status.
     */
    async identifyAgents(requests: IdentificationRequest[]): Promise<IdentificationResult[]> {
        const response = await fetch("https://api.knownagents.com/agent-identifications", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${this.accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(requests.map((request) => {
                return {
                    ...request,
                    request_headers: getFilteredHeaders(request.request_headers),
                    node_package_version: NODE_PACKAGE_VERSION
                }
            }))
        })

        if (response.ok) {
            return await response.json()
        } else {
            throw new Error(`Known Agents failed to identify agents: ${response.status} ${response.statusText}`)
        }
    }

    private enqueueVisit(request: VisitRequest): void {
        this.visitQueue.push({
            ...request,
            request_headers: getFilteredHeaders(request.request_headers),
            response_headers: request.response_headers ? getFilteredHeaders(request.response_headers) : undefined,
        })

        if (this.visitQueue.length >= this.flushQueueSize) {
            void this.flush()
            return
        }

        this.scheduleFlush()
    }

    private scheduleFlush(): void {
        if (this.flushTimeout) {
            return
        }

        this.flushTimeout = setTimeout(() => {
            this.flushTimeout = undefined
            void this.flush()
        }, this.flushIntervalInMilliseconds)

        this.flushTimeout.unref()
    }

    private async sendVisits(requests: VisitRequest[]): Promise<void> {
        try {
            const response = await fetch("https://api.knownagents.com/visits", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.accessToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(requests.map((request) => {
                    return {
                        ...request,
                        node_package_version: NODE_PACKAGE_VERSION
                    }
                }))
            })

            if (!response.ok) {
                throw new Error(`${response.status} ${response.statusText}`)
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            console.error(`Known Agents failed to track visits: ${message}`)
        }
    }
}
