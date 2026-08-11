import type { IncomingHttpHeaders, OutgoingHttpHeaders } from "http"

/**
 * Batching configuration for the Known Agents client.
 */
export interface KnownAgentsOptions {
    /** The maximum time a partial visit event queue waits before upload. Defaults to 10,000 milliseconds. */
    flushIntervalInMilliseconds?: number
    /** The number of visit events in the queue that triggers an upload. Defaults to 1. */
    flushQueueSize?: number
}

/**
 * Additional metadata to include when tracking a pageview or REST API call.
 */
export interface TrackPageviewOrRESTCallOptions {
    /** The ACP response body. */
    acpResponseBody?: Record<string, unknown>
    /** The UCP response body. */
    ucpResponseBody?: Record<string, unknown>
}

/**
 * A normalized visit payload for the Known Agents API.
 * Use this with `trackVisits()` to manually add visit events to the queue.
 */
export interface VisitRequest {
    /** The URL path and query string of the request (e.g. "/about?foo=bar") */
    request_path: string
    /** The HTTP method (e.g. "GET", "POST") */
    request_method: string
    /** The HTTP request headers. Sensitive headers are removed before sending. */
    request_headers: IncomingHttpHeaders
    /** The HTTP response status code (e.g. 200, 404) */
    response_status_code?: number
    /** The HTTP response headers. Sensitive headers are removed before sending. */
    response_headers?: OutgoingHttpHeaders
    /** The response duration in milliseconds */
    response_duration_in_milliseconds?: number
    /** The MCP JSON-RPC request method */
    mcp_request_method?: string
    /** The MCP request tool name */
    mcp_request_tool_name?: string
    /** The MCP request client name */
    mcp_request_client_info_name?: string
    /** The MCP request client version */
    mcp_request_client_info_version?: string
    /** Whether the MCP response result is an error */
    mcp_response_result_is_error?: boolean
    /** The MCP response error code */
    mcp_response_error_code?: number
    /** The MCP response error message */
    mcp_response_error_message?: string
    /** The ACP response body */
    acp_response_body?: Record<string, unknown>
    /** The UCP response body */
    ucp_response_body?: Record<string, unknown>
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
    /** The HTTP request headers. Sensitive headers are removed before sending. */
    request_headers: IncomingHttpHeaders
    /** The path of the incoming request (e.g. `"/products/123"`). */
    request_path?: string
}

/**
 * The result of an agent identification request.
 */
export interface IdentificationResult {
    /** The identifier from the request (if provided). */
    id?: string
    /**
     * The identification result:
     * - "verified": A known agent was identified and verified
     * - "verification_failed": A known agent was identified, but failed verification
     * - "not_verifiable": A known agent was identified, but no verification method was available
     * - "not_identified": No known agent was identified
     */
    result: "verified" | "verification_failed" | "not_verifiable" | "not_identified"
    /** The unique ID of the identified agent. */
    agent_id?: string
    /** The name of the agent (e.g. `"Claude-User"`) (if identified). */
    agent_token?: string
    /** The documentation URL of the agent (if identified). */
    agent_url?: string
    /** The type of agent (e.g. `"AI Assistant"`) (if identified). */
    agent_type_name?: string
    /** The company operating the agent (e.g. `"Anthropic"`) (if identified). */
    operator_name?: string
    /** Whether the identified agent is disallowed by robots.txt from accessing the `request_path`. */
    is_disallowed_by_robots_txt?: boolean
    /** The autonomous system number associated with the request's IPv4 address. */
    asn?: number
    /** The operator of the recognized autonomous system associated with the request's IPv4 address. */
    asn_operator?: string
    /**
     * The type of the recognized autonomous system associated with the request's IPv4 address:
     * - "isp"
     * - "hosting"
     * - "business"
     * - "education"
     * - "government"
     */
    asn_type?: "isp" | "hosting" | "business" | "education" | "government"
    /** An integer from `0` to `99` indicating the strength of heuristic evidence that the request was made by an automated client. Higher scores indicate stronger detected automation signals. A score of `0` means that no automation signals were detected, not that the client is certainly human. */
    automation_score?: number
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
    AutomatedAgent = "Automated Agent",
    DeveloperHelper = "Developer Helper",
    Fetcher = "Fetcher",
    IntelligenceGatherer = "Intelligence Gatherer",
    Scraper = "Scraper",
    SEOCrawler = "SEO Crawler",
    SearchEngineCrawler = "Search Engine Crawler",
    SecurityScanner = "Security Scanner",
    UndocumentedAIAgent = "Undocumented AI Agent"
}
