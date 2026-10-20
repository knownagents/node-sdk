# Known Agents SDK

[![NPM version](https://img.shields.io/npm/v/@knownagents/sdk.svg)](https://npmjs.org/package/@knownagents/sdk)

This library provides convenient access to [Known Agents](https://knownagents.com/) from server-side Node.js applications written in TypeScript or JavaScript.

## Install the Package

Download and include the package via NPM:

```sh
npm install @knownagents/sdk
```

## Initialize the Client

[Sign up](https://knownagents.com/sign-up) for Known Agents, create a project, and copy your access token from the project's settings page. Then, create a new instance of `KnownAgents`.

```ts
import { KnownAgents } from "@knownagents/sdk"

const knownAgents = new KnownAgents("YOUR_ACCESS_TOKEN")
```

To batch visits, set the visit event queue size and flush interval:

```ts
const knownAgents = new KnownAgents("YOUR_ACCESS_TOKEN", {
    flushQueueSize: 1000,
    flushIntervalInMilliseconds: 10000
})
```

The entire visit event queue is uploaded when it reaches `flushQueueSize` or when the flush interval elapses after the first visit event enters an empty queue.

Before your application shuts down, call `flush` to upload any queued visit events:

```ts
await knownAgents.flush()
```

## Track Pageviews and API Calls ([Agent Analytics](https://knownagents.com/products/agent-analytics), [LLM Referral Tracking](https://knownagents.com/products/llm-referral-tracking))

Get realtime insight into how [AI agents and other bots](https://knownagents.com/agents) browse your web pages, use your [MCP](https://modelcontextprotocol.io/) (Model Context Protocol) server, and purchase products through your [ACP](https://www.agenticcommerce.dev/) (Agentic Commerce Protocol) and [UCP](https://ucp.dev/) (Universal Commerce Protocol) shopping flows. Measure human traffic from AI chat and search platforms like ChatGPT, Claude, and Gemini.

Call `trackVisit` with the incoming request and outgoing response.

```ts
knownAgents.trackVisit(request, response)
```

If you can, do this in middleware.

### MCP

For MCP endpoints, call `trackVisit` from each tool handler.

```ts
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server"

const mcpHandler = createMcpHandler(({ requestInfo }) => {
    const server = new McpServer({
        name: SERVER_NAME,
        version: SERVER_VERSION,
    })

    server.registerTool("ping", { description: "Check whether the server is available" }, async (context) => {
        const result = {
            content: [{ type: "text", text: "pong" }]
        }

        knownAgents.trackVisit(requestInfo, undefined, {
            mcp: {
                context: context,
                result: result,
                toolName: "ping"
            }
        })

        return result
    })

    return server
})
```

### Agentic Commerce

For ACP and UCP endpoints, include the response body in `trackVisit`.

```ts
// For ACP calls ...

knownAgents.trackVisit(request, response, {
    acp: {
        responseBody: acpResponseBody
    }
})
```

```ts
// For UCP calls ...

knownAgents.trackVisit(request, response, {
    ucp: {
        responseBody: ucpResponseBody
    }
})
```

## Serve an Automatic Robots.txt ([Automatic Robots.txt](https://knownagents.com/products/automatic-robots-txt))

Generate a robots.txt that continuously updates with rules for new [crawlers, scrapers, AI agents, and other bots](https://knownagents.com/agents) as they're discovered.

Use the `generateRobotsTXT` method. Select which `AgentType`s you want to block, and a string specifying which URLs are disallowed (e.g. `"/"` to disallow all paths).

```ts
import { AgentType } from "@knownagents/sdk"

const robotsTxt = await knownAgents.generateRobotsTXT([
    AgentType.AIDataScraper,
    AgentType.AIDataProvider,
    AgentType.Scraper,
    AgentType.SEOCrawler
], "/")
```

The return value is a plain text robots.txt string. Generate a `robotsTxt` periodically (e.g. once per day, using a cron job). Then, serve it from your website's `/robots.txt` endpoint.

## Identify & Verify Agents ([Agent Identification](https://knownagents.com/products/agent-identification-api))

Identify and verify [AI agents and other bots](https://knownagents.com/agents) in your own products, from incoming network requests. Authentication uses Web Bot Auth (HTTP message signatures), IP matching, or other available methods. This API can be useful for implementing access policies based on verified agent identity or enriching your own datasets.

Call `identifyAgent` to identify a single incoming request:

```ts
const identification = await knownAgents.identifyAgent(request)
```

Call `identifyAgents` to identify multiple requests at once:

```ts
const identifications = await knownAgents.identifyAgents([
    {
        request_id: "request-1",
        request_headers: request1.headers,
        request_path: request1.url
    },
    {
        request_id: "request-2",
        request_headers: request2.headers,
        request_path: request2.url
    }
])
```

Identification requests accept the following fields:

- `request_id`: A string identifier that will be echoed back in the response. Include this when sending an array to match each result to its request.
- `request_headers` (required): An object containing all available HTTP request headers, including `user-agent` when present, any IP-related headers like `x-forwarded-for` or `x-real-ip`, and HTTP message signature headers like `signature-input`, `signature`, and `signature-agent`.
- `request_ip`: The transport-level IP address of the incoming request. Used as a fallback when a valid client IP address cannot be derived from `request_headers`.
- `request_path`: The path of the incoming request (e.g. `"/products/123"`).

These methods return an object (or array of objects) with the following fields:

- `request_id`: The identifier from the request (if provided).
- `result`: The identification result:
  - `"verified"`: A known agent was identified and verified (its identity was confirmed as authentic)
  - `"verification_failed"`: A known agent was identified, but failed verification (its identity may have been spoofed)
  - `"not_verifiable"`: A known agent was identified, but its operator does not provide a known verification method
  - `"not_identified"`: No known agent was identified (the request may have come from a human)
- `agent_id`: The unique ID of the identified agent.
- `agent_token`: The name of the agent (e.g. `"Claude-User"`) (if identified).
- `agent_url`: The documentation URL of the agent (if identified).
- `agent_type_name`: The type of agent (e.g. `"AI Assistant"`) (if identified).
- `operator_name`: The company operating the agent (e.g. `"Anthropic"`) (if identified).
- `is_disallowed_by_robots_txt`: Whether the identified agent is disallowed by robots.txt from accessing the `request_path`.
- `asn`: The autonomous system number associated with the request's IP address.
- `asn_operator`: The operator of the recognized autonomous system associated with the request's IP address.
- `asn_type`: The type of the recognized autonomous system associated with the request's IP address:
  - `"isp"`
  - `"hosting"`
  - `"business"`
  - `"education"`
  - `"government"`
- `automation_score`: An integer from `0` to `99` indicating the strength of heuristic evidence that the request was made by an automated client. Higher scores indicate stronger detected automation signals. A score of `0` means that no automation signals were detected, not that the client is certainly human.
- `automation_signals`: Specific automation signals detected for the request. Available to Enterprise plans upon request:
  - `"known_agent_ip"`: The request came from an IP address associated with a known agent, although no specific agent was identified
  - `"inconsistency"`: The request contained inconsistent client or browser attributes
  - `"non_browser"`: The request appears to have been made by a non-browser HTTP client
  - `"automated_browser"`: The request contains indicators of browser automation
  - `"cloud_service_provider"`: The request came from cloud or hosting infrastructure

See the [Agent Identification REST API documentation](https://knownagents.com/docs/identification/rest-api) for the canonical API reference.

## Requirements

TypeScript >= 4.7 is supported.

The following runtimes are supported:

- Node.js 20 or later (Node.js 24 LTS recommended)

## Support

Please [open an issue](https://github.com/knownagents/node-sdk/issues) with questions, bugs, or suggestions.
