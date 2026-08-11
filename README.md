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

## Send Visit Events ([Agent Analytics](https://knownagents.com/products/agent-analytics), [LLM Referral Tracking](https://knownagents.com/products/llm-referral-tracking))

Get realtime insight into how [AI agents and other bots](https://knownagents.com/agents) browse your web pages, call your [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) endpoints, and purchase products through your [ACP (Agentic Commerce Protocol)](https://www.agenticcommerce.dev/) and [UCP (Universal Commerce Protocol)](https://ucp.dev/) shopping flows. Measure human traffic from AI chat and search platforms like ChatGPT, Claude, and Gemini.

### Pageviews and REST Calls

Call `trackPageviewOrRESTCall` with the incoming request and outgoing response. If you can, do this in middleware. This method skips MCP calls automatically.

```ts
knownAgents.trackPageviewOrRESTCall(request, response)
```

### MCP Calls (Optional)

For MCP servers that use `StreamableHTTPServerTransport`, call `trackMCPCall` after connecting the transport and before the transport handles the request.

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"

// ...

const mcpServer = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
})

const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined
})

// ...

await mcpServer.connect(transport)

knownAgents.trackMCPCall(request, response, transport)

await transport.handleRequest(request, response, parsedBody)
```

### Agentic Commerce Interactions (Optional)

For REST implementations of ACP and UCP, include the response body in `trackPageviewOrRESTCall`.

```ts
// For ACP calls ...

knownAgents.trackPageviewOrRESTCall(request, response, {
    acpResponseBody: acpResponseBody
})
```

```ts
// For UCP calls ...

knownAgents.trackPageviewOrRESTCall(request, response, {
    ucpResponseBody: ucpResponseBody
})
```

`trackMCPCall` will track MCP implementations of ACP and UCP automatically.

### Test Your Integration

- Open your project's settings page
- Click **Send a Test Visit**
- Click **Realtime**

If your website is correctly connected, you should see visits from a test agent in the realtime timeline within a few seconds.

## Set Up Automatic Robots.txt ([Automatic Robots.txt](https://knownagents.com/products/automatic-robots-txt))

Serve a robots.txt that continuously updates with rules for new [crawlers, scrapers, AI agents, and other bots](https://knownagents.com/agents) as they're discovered.

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

## Use the Agent Identification API ([Agent Identification API](https://knownagents.com/products/agent-identification-api))

Identify and verify [AI agents and other bots](https://knownagents.com/agents) in your own products, from incoming network requests. Authentication uses Web Bot Auth (HTTP message signatures), IP matching, or other available methods. This API can be useful for implementing access policies based on verified agent identity or enriching your own datasets.

Call `identifyAgent` to identify a single incoming request:

```ts
const identification = await knownAgents.identifyAgent(request)
```

Call `identifyAgents` to identify multiple requests at once:

```ts
const identifications = await knownAgents.identifyAgents([
    {
        id: "request-1",
        request_headers: request1.headers,
        request_path: request1.url
    },
    {
        id: "request-2",
        request_headers: request2.headers,
        request_path: request2.url
    }
])
```

These methods return an object (or array of objects) with the following fields:

- `id`: The identifier from the request (if provided).
- `result`: The identification result:
  - `"verified"`: A known agent was identified and verified
  - `"verification_failed"`: A known agent was identified, but failed verification
  - `"not_verifiable"`: A known agent was identified, but no verification method was available
  - `"not_identified"`: No known agent was identified
- `agent_id`: The unique ID of the identified agent.
- `agent_token`: The name of the agent (e.g. `"Claude-User"`) (if identified).
- `agent_url`: The documentation URL of the agent (if identified).
- `agent_type_name`: The type of agent (e.g. `"AI Assistant"`) (if identified).
- `operator_name`: The company operating the agent (e.g. `"Anthropic"`) (if identified).
- `is_disallowed_by_robots_txt`: Whether the identified agent is disallowed by robots.txt from accessing the `request_path`.
- `asn`: The autonomous system number associated with the request's IPv4 address.
- `asn_operator`: The operator of the recognized autonomous system associated with the request's IPv4 address.
- `asn_type`: The type of the recognized autonomous system associated with the request's IPv4 address:
  - `"isp"`
  - `"hosting"`
  - `"business"`
  - `"education"`
  - `"government"`
- `automation_score`: An integer from `0` to `99` indicating the strength of heuristic evidence that the request was made by an automated client. Higher scores indicate stronger detected automation signals. A score of `0` means that no automation signals were detected, not that the client is certainly human.

## Requirements

TypeScript >= 4.7 is supported.

The following runtimes are supported:

- Node.js 18 LTS or later ([non-EOL](https://endoflife.date/nodejs))

## Support

Please [open an issue](https://github.com/knownagents/node-sdk/issues) with questions, bugs, or suggestions.
