import type { IncomingHttpHeaders, OutgoingHttpHeaders } from "http"

/**
 * ACP response details from a REST API call.
 */
export interface RESTACPResponseBody {
    /** The response currency, usually an ISO 4217 code. */
    currency?: string
    /** ACP totals returned by the REST endpoint. The "total" item is sent to Known Agents. */
    totals?: {
        type?: string
        amount?: number
    }[]
}

/**
 * UCP response details from a REST API call.
 */
export interface RESTUCPResponseBody {
    /** The response currency, usually an ISO 4217 code. */
    currency?: string
    /** UCP totals returned by the REST endpoint. The "total" item is sent to Known Agents. */
    totals?: {
        type?: string
        amount?: number
    }[]
}

/**
 * Additional metadata to include when tracking a pageview or REST API call.
 */
export interface TrackPageviewOrRESTCallOptions {
    /** ACP response body from the REST endpoint. */
    restACPResponseBody?: RESTACPResponseBody
    /** UCP response body from the REST endpoint. */
    restUCPResponseBody?: RESTUCPResponseBody
}

/**
 * A normalized visit payload for the Known Agents API.
 * Use this with `trackVisits()` when batching requests yourself.
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
    /** The ACP response currency */
    acp_response_currency?: string
    /** The ACP response "total" amount */
    acp_response_total_amount?: number
    /** The UCP response currency */
    ucp_response_currency?: string
    /** The UCP response "total" amount */
    ucp_response_total_amount?: number
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
