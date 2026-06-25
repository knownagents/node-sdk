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

## How To Set Up Agent & LLM Analytics ([Full Docs](https://knownagents.com/docs/analytics))

Get realtime insight into how [AI agents and other bots](https://knownagents.com/agents) browse your web pages, call your [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) endpoints, and purchase products through your [ACP (Agentic Commerce Protocol)](https://www.agenticcommerce.dev/) and [UCP (Universal Commerce Protocol)](https://ucp.dev/) shopping flows. Measure human traffic from AI chat and search platforms like ChatGPT, Claude, and Gemini.

### Track Pageviews and REST Calls

Call `trackPageviewOrRESTCall` with the incoming request and outgoing response. If you can, do this in middleware.

```ts
knownAgents.trackPageviewOrRESTCall(request, response)
```

MCP calls are skipped automatically by `trackPageviewOrRESTCall`. Use `trackMCPCall` to track MCP calls.

High-traffic websites should not use this method. Instead, batch visits and send them periodically with `trackVisits` (see below).

#### Agentic Commerce Calls

For REST implementations of ACP and UCP, include the response body.

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

### Track MCP Calls

For MCP servers that use `StreamableHTTPServerTransport`, call `trackMCPCall` after connecting the transport and before the transport handles the request.

High-traffic websites, or those that use the same transport instance to handle multiple concurrent requests, should not use this method. Instead, batch visits and send them periodically with `trackVisits` (see below).

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

#### Agentic Commerce Calls

This method will track MCP implementations of ACP and UCP automatically.

### Batching for High-Traffic Websites

High-traffic websites should batch multiple visits together and send them periodically (e.g. every 30 seconds) using `trackVisits`. This method can track pageviews, REST, MCP, ACP, and UCP calls. Here's an example with Express middleware:

```ts
import express from "express"
import { KnownAgents, type VisitRequest } from "@knownagents/sdk"

const app = express()

const knownAgents = new KnownAgents("YOUR_ACCESS_TOKEN")
const visits: VisitRequest[] = []

app.use((request, response, next) => {
    const created = new Date()

    response.once("finish", () => {
        visits.push({
            request_path: request.url,
            request_method: request.method,
            request_headers: request.headers,
            response_status_code: response.statusCode,
            response_headers: response.getHeaders(),
            response_duration_in_milliseconds: Date.now() - created.getTime(),
            created: created.toISOString()
        })
    })

    next()
})

setInterval(() => {
    const batch = visits.splice(0)

    if (batch.length > 0) {
        knownAgents.trackVisits(batch)
    }
}, 30000)
```

### Test Your Integration

- Open your project's settings page
- Click **Send a Test Visit**
- Click **Realtime**

If your website is correctly connected, you should see visits from a test agent in the realtime timeline within a few seconds.

## How To Set Up Automatic Robots.txt ([Full Docs](https://knownagents.com/docs/robots-txt))

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

## How To Use the Agent Identification API ([Full Docs](https://knownagents.com/docs/identification))

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
        request_headers: request1.headers
    },
    {
        id: "request-2",
        request_headers: request2.headers
    }
])
```

These methods return an object (or array of objects) with the following fields:

- `id`: The identifier from the request (if provided)
- `result`: The identification result:
  - `"verified"`: The agent was identified and verified
  - `"verification_failed"`: The agent was identified but failed verification (it was spoofed)
  - `"not_verifiable"`: The agent was identified but could not be verified (no method available)
  - `"unknown_agent"`: Not an agent, or the agent is not in the database
- `agent_id`: The unique ID of the agent (if identified)
- `agent_token`: The name of the agent (e.g. `"Claude-User"`) (if identified)
- `agent_url`: The documentation URL of the agent (if identified)
- `agent_type_name`: The type of agent (e.g. `"AI Assistant"`) (if identified)
- `operator_name`: The company operating the agent (e.g. `"Anthropic"`) (if identified)

## Requirements

TypeScript >= 4.7 is supported.

The following runtimes are supported:

- Node.js 18 LTS or later ([non-EOL](https://endoflife.date/nodejs))

## Support

Please [open an issue](https://github.com/knownagents/node-sdk/issues) with questions, bugs, or suggestions.
