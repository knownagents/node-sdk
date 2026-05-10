import { IncomingMessage, ServerResponse } from "http"

/**
 * A framework-agnostic HTTP request interface.
 * Used as a convenience type for single-request methods.
 */
export interface Request {
    /** The URL path and query string (e.g. "/about?foo=bar") */
    path: string
    /** The HTTP method (e.g. "GET", "POST") */
    method: string
    /** The HTTP request headers */
    headers: Record<string, string | string[] | undefined>
}

/**
 * A minimal HTTP response interface.
 * Used as a convenience type for single-request methods.
 */
export interface Response {
    /** The HTTP response status code (e.g. 200, 404) */
    statusCode: number
    /** The HTTP response headers */
    headers?: Record<string, string | string[] | undefined>
}

/**
 * A visit tracking request for the Known Agents API.
 * Used for batch visit tracking with `trackVisits()`.
 */
export interface VisitRequest {
    /** The URL path of the request (e.g. "/about?foo=bar") */
    request_path: string
    /** The HTTP method (e.g. "GET", "POST") */
    request_method: string
    /** The HTTP request headers */
    request_headers: Record<string, string | string[] | undefined>
    /** The HTTP response status code (e.g. 200, 404) */
    response_status_code?: number
    /** The HTTP response headers */
    response_headers?: Record<string, string | string[] | undefined>
    /** The response duration in milliseconds */
    response_duration_in_milliseconds?: number
    /** The timestamp when the visit occurred (ISO 8601 format) */
    created?: string
}

/**
 * An agent identification request for the Known Agents API.
 * Used for batch agent identification with `identifyAgents()`.
 */
export interface IdentificationRequest {
    /** An identifier that will be echoed back in the response to match requests with results */
    id?: string
    /** The HTTP request headers */
    request_headers: Record<string, string | string[] | undefined>
}

/**
 * The result of an agent identification request.
 */
export interface IdentificationResult {
    /** The identifier from the request (if provided) */
    id?: string
    /** 
     * The identification result:
     * - "verified": The agent was identified and verified
     * - "verification_failed": The agent was identified but failed verification (spoofed)
     * - "unknown_agent": The request is from an unrecognized agent or human
     * - "not_verifiable": The agent was identified but cannot be verified
     */
    result: "verified" | "verification_failed" | "unknown_agent" | "not_verifiable"
    /** The unique ID of the identified agent */
    agent_id?: string
    /** The name of the identified agent (e.g. "Googlebot") */
    agent_token?: string
    /** The documentation URL for the identified agent */
    agent_url?: string
    /** The type of the identified agent (e.g. "AI Agent", "Search Engine Crawler") */
    agent_type_name?: string
    /** The company behind the identified agent (e.g. "Google") */
    operator_name?: string
}

/**
 * Agent types that can be controlled with robots.txt rules.
 */
export enum AgentType {
    AIAgent = "AI Agent",
    AIAssistant = "AI Assistant",
    AICodingAgent = "AI Coding Agent",
    AIDataProvider = "AI Data Provider",
    AIDataScraper = "AI Data Scraper",
    AISearchCrawler = "AI Search Crawler",
    Archiver = "Archiver",
    DeveloperHelper = "Developer Helper",
    Fetcher = "Fetcher",
    HeadlessAgent = "Headless Agent",
    IntelligenceGatherer = "Intelligence Gatherer",
    Scraper = "Scraper",
    SEOCrawler = "SEO Crawler",
    SearchEngineCrawler = "Search Engine Crawler",
    SecurityScanner = "Security Scanner",
    UndocumentedAIAgent = "Undocumented AI Agent"
}

export class KnownAgents {
    private readonly accessToken: string

    /**
     * Creates a new instance of the Known Agents client.
     * 
     * @param accessToken - Your project's access token.
     */
    constructor(accessToken: string) {
        this.accessToken = accessToken
    }

    /**
     * Tracks a single agent visit for analytics.
     * This method is non-blocking and handles errors internally.
     *
     * @param request - The incoming HTTP request (Request or Node.js IncomingMessage).
     * @param response - The outgoing HTTP response (optional).
     * @param responseDurationInMilliseconds - The time taken to process the request in milliseconds (optional).
     */
    trackVisit(request: Request | IncomingMessage, response?: Response | ServerResponse, responseDurationInMilliseconds?: number): void {
        const path = "path" in request ? request.path : request.url

        if (!path || this.isPathExcluded(path)) {
            return
        }

        const responseHeaders = response instanceof ServerResponse ? response.getHeaders() as Record<string, string | string[] | undefined> : response?.headers

        fetch("https://api.knownagents.com/visits", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${this.accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                request_path: path,
                request_method: request.method,
                request_headers: this.filterHeaders(request.headers),
                response_status_code: response?.statusCode,
                response_headers: responseHeaders ? this.filterHeaders(responseHeaders) : undefined,
                response_duration_in_milliseconds: responseDurationInMilliseconds,
                created: new Date().toISOString()
            })
        }).catch(error => {
            console.error(`Known Agents failed to track visit: ${error.message}`)
        })
    }

    /**
     * Tracks multiple agent visits in a batch for analytics.
     * This method is non-blocking and handles errors internally.
     * Recommended for high-traffic websites - batch visits and send periodically (e.g. every 30 seconds).
     *
     * @param visits - An array of visit tracking requests.
     */
    trackVisits(visits: VisitRequest[]): void {
        const filteredVisits = visits
            .filter((visit) => {
                return !this.isPathExcluded(visit.request_path)
            })
            .map((visit) => {
                return {
                    ...visit,
                    request_headers: this.filterHeaders(visit.request_headers),
                    response_headers: visit.response_headers ? this.filterHeaders(visit.response_headers) : undefined,
                }
            })

        if (filteredVisits.length === 0) {
            return
        }

        fetch("https://api.knownagents.com/visits", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${this.accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(filteredVisits)
        }).catch(error => {
            console.error(`Known Agents failed to track visits: ${error.message}`)
        })
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
     * @param request - The incoming HTTP request (Request or Node.js IncomingMessage).
     * @returns A promise that resolves to the identification result.
     * @throws {Error} If the API call fails or returns a non-200 status.
     */
    async identifyAgent(request: Request | IncomingMessage): Promise<IdentificationResult> {
        const response = await fetch("https://api.knownagents.com/agent-identifications", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${this.accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                request_headers: this.filterHeaders(request.headers)
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
                    request_headers: this.filterHeaders(request.request_headers),
                }
            }))
        })

        if (response.ok) {
            return await response.json()
        } else {
            throw new Error(`Known Agents failed to identify agents: ${response.status} ${response.statusText}`)
        }
    }

    // Helpers

    private isPathExcluded(path: string): boolean {
        const excludedPrefixes = [
            "/_next/",
            "/_nuxt/",
            "/_astro/",
            "/_app/",
            "/@vite/",
            "/@fs/",
            "/@id/",
            "/node_modules/",
            "/_vercel/",
        ]

        const excludedSuffixes = [
            ".ico",
            ".png",
            ".jpg",
            ".jpeg",
            ".gif",
            ".webp",
            ".svg",
            ".bmp",
            ".tiff",
            ".avif",
            ".css",
            ".js",
            ".mjs",
            ".ts",
            ".jsx",
            ".tsx",
            ".map",
            ".woff",
            ".woff2",
            ".ttf",
            ".otf",
            ".eot",
            ".mp3",
            ".mp4",
            ".webm",
            ".wav",
            ".ogg",
            ".mov",
            ".avi",
            ".flv",
            ".m4v",
            ".rss",
            ".json",
            ".xml",
            ".pdf",
            ".zip",
        ]

        return excludedPrefixes.some((excludedPrefix) => {
            return path.toLowerCase().startsWith(excludedPrefix.toLowerCase())
        }) || excludedSuffixes.some((excludedSuffix) => {
            return path.toLowerCase().endsWith(excludedSuffix.toLowerCase())
        })
    }

    private filterHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string | string[] | undefined> {
        const excludedHeaders = new Set([
            "authorization",
            "proxy-authorization",
            "cookie",
            "set-cookie"
        ])

        return Object.fromEntries(
            Object.entries(headers).filter(([key]) => {
                return !excludedHeaders.has(key.toLowerCase())
            })
        )
    }
}