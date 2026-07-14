import type { IncomingMessage, ServerResponse } from "http"
import type { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { getFilteredHeaders, getIsACPCall, getIsMCPCall, getIsUCPCall } from "./headers"
import { getIsPathExcluded } from "./paths"
import type {
    AgentType,
    IdentificationRequest,
    IdentificationResult,
    KnownAgentsOptions,
    TrackPageviewOrRESTCallOptions,
    VisitRequest
} from "./types"

const DEFAULT_FLUSH_INTERVAL_IN_MILLISECONDS = 10000
const DEFAULT_FLUSH_QUEUE_SIZE = 1

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
     * Tracks a single non-MCP pageview or REST API call for analytics.
     * The visit is added to the visit event queue after the response finishes so status, headers, and duration are included.
     * This method is non-blocking and handles upload errors internally.
     *
     * @param request - The incoming Node.js HTTP request.
     * @param response - The outgoing Node.js HTTP response.
     * @param options - Optional ACP or UCP response metadata for REST API calls.
     */
    trackPageviewOrRESTCall(request: IncomingMessage, response: ServerResponse, options?: TrackPageviewOrRESTCallOptions): void {
        const isMCPCall = getIsMCPCall(request.headers)
        const path = request.url
        const method = request.method

        if (isMCPCall || !path || getIsPathExcluded(path) || !method) {
            return
        }

        const created = new Date()

        const sendVisit = () => {
            const responseDurationInMilliseconds = Date.now() - created.getTime()

            const visitRequest: VisitRequest = {
                request_path: path,
                request_method: method,
                request_headers: request.headers,
                response_status_code: response?.statusCode,
                response_headers: response.getHeaders(),
                response_duration_in_milliseconds: responseDurationInMilliseconds,
                acp_response_body: options?.acpResponseBody,
                ucp_response_body: options?.ucpResponseBody,
                created: created.toISOString()
            }

            this.trackVisits([visitRequest])
        }

        if (response.writableEnded) {
            sendVisit()
        } else {
            response.once("finish", sendVisit)
        }
    }

    /**
     * Tracks a single MCP call handled by `StreamableHTTPServerTransport`.
     * Call this after connecting the transport and before the transport processes the request so request and response metadata can be captured.
     * Do not use this with transport instances shared across concurrent requests; use `trackVisits()` instead.
     * This method is non-blocking and handles upload errors internally.
     *
     * @param request - The incoming Node.js HTTP request.
     * @param response - The outgoing Node.js HTTP response.
     * @param transport - The MCP streamable HTTP transport handling the request.
     */
    trackMCPCall(request: IncomingMessage, response: ServerResponse, transport: StreamableHTTPServerTransport): void {
        const path = request.url
        const method = request.method

        if (!path || getIsPathExcluded(path) || !method) {
            return
        }

        const created = new Date()

        let mcpRequestBody: any
        let mcpResponseBody: any

        const originalTransportOnMessage = transport.onmessage
        transport.onmessage = (message, extra): void => {
            mcpRequestBody = message
            originalTransportOnMessage?.(message, extra)
        }

        const originalTransportSend = transport.send
        transport.send = async (message, options): Promise<void> => {
            mcpResponseBody = message
            await originalTransportSend.call(transport, message, options)
        }

        const restoreTransport = () => {
            transport.onmessage = originalTransportOnMessage
            transport.send = originalTransportSend
        }

        const sendVisit = () => {
            restoreTransport()

            if (!mcpRequestBody || !mcpResponseBody) {
                return
            }

            const responseDurationInMilliseconds = Date.now() - created.getTime()

            const visitRequest: VisitRequest = {
                request_path: path,
                request_method: method,
                request_headers: request.headers,
                response_status_code: response?.statusCode,
                response_headers: response.getHeaders(),
                response_duration_in_milliseconds: responseDurationInMilliseconds,
                mcp_request_method: mcpRequestBody.method,
                mcp_request_tool_name: mcpRequestBody.params?.name,
                mcp_request_client_info_name: mcpRequestBody.params?.clientInfo?.name,
                mcp_request_client_info_version: mcpRequestBody.params?.clientInfo?.version,
                mcp_response_result_is_error: mcpResponseBody.result?.isError,
                mcp_response_error_code: mcpResponseBody.error?.code,
                mcp_response_error_message: mcpResponseBody.error?.message,
                acp_response_body: getIsACPCall(request.headers) ? mcpResponseBody.result?.structuredContent ?? mcpResponseBody.result : undefined,
                ucp_response_body: getIsUCPCall(request.headers) ? mcpResponseBody.result?.structuredContent ?? mcpResponseBody.result : undefined,
                created: created.toISOString()
            }

            this.trackVisits([visitRequest])
        }

        if (response.writableEnded) {
            sendVisit()
        } else {
            response.once("finish", sendVisit)
        }
    }

    /**
     * Adds multiple visits to the visit event queue for analytics.
     * This method is non-blocking and handles upload errors internally.
     * All visit events are uploaded together when the queue size reaches the configured threshold or the flush interval elapses.
     *
     * @param requests - An array of visits.
     */
    trackVisits(requests: VisitRequest[]): void {
        const filteredRequests = requests
            .filter((request) => {
                return !getIsPathExcluded(request.request_path)
            })
            .map((request) => {
                return {
                    ...request,
                    request_headers: getFilteredHeaders(request.request_headers),
                    response_headers: request.response_headers ? getFilteredHeaders(request.response_headers) : undefined,
                }
            })

        if (filteredRequests.length === 0) {
            return
        }

        this.visitQueue.push(...filteredRequests)

        if (this.visitQueue.length >= this.flushQueueSize) {
            void this.flush()
            return
        }

        this.scheduleFlush()
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
                disallow: disallow
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
                request_headers: getFilteredHeaders(request.headers)
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
            body: JSON.stringify(requests.map(request => {
                return {
                    ...request,
                    request_headers: getFilteredHeaders(request.request_headers),
                }
            }))
        })

        if (response.ok) {
            return await response.json()
        } else {
            throw new Error(`Known Agents failed to identify agents: ${response.status} ${response.statusText}`)
        }
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
                body: JSON.stringify(requests)
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
