import { IncomingMessage } from "http"

const NODE_PACKAGE_VERSION = "1.3.0"

export interface Request {
    /** The path of the request's URL (e.g. "/about") */
    path: string
    /** The request's HTTP method (e.g. "GET", "POST") */
    method: string
    /** The request's HTTP headers */
    headers: Record<string, string | string[] | undefined>
}

/**
 * Agent types that can be controlled with robots.txt rules.
 */
export enum AgentType {
    AIAgent = "AI Agent",
    AIAssistant = "AI Assistant",
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
     * Tracks an agent visit in Known Agents agent analytics.
     *
     * @param visitRequest - The incoming visit request.
     */
    trackVisit(request: Request): void
    trackVisit(request: IncomingMessage): void
    trackVisit(visitRequest: Request | IncomingMessage): void {
        const request: Request = "path" in visitRequest ? visitRequest : {
            path: visitRequest.url ? new URL(visitRequest.url, "https://example.org/").pathname : "/",
            method: visitRequest.method ?? "GET",
            headers: visitRequest.headers
        }

        fetch("https://api.knownagents.com/visits", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${this.accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                request_path: request.path,
                request_method: request.method,
                request_headers: this.filterHeaders(request.headers),
                node_package_version: NODE_PACKAGE_VERSION
            })
        }).catch(error => {
            console.error(`Known Agents failed to track visit: ${error.message}`)
        })
    }

    /**
     * Generates a `robots.txt` file that disallows the specified agent types.
     * Cache and serve this string at your website’s `/robots.txt` endpoint.
     *
     * @param agentTypes - A list of agent types to include.
     * @param disallow - A path to disallow (default is "/" for all paths).
     * @returns The generated `robots.txt` as a string.
     * @throws If the API call fails or returns a non-200 status.
     */
    async generateRobotsTxt(agentTypes: AgentType[], disallow: string = "/"): Promise<string> {
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

    // Helpers

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