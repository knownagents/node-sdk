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

Get realtime insight into the hidden ecosystem of [AI agents and other bots](https://knownagents.com/agents) browsing your website, REST APIs, and [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) servers. Measure human traffic coming from AI chat and search platforms like ChatGPT, Perplexity, and Gemini.

### Track Pageview and REST Calls

To collect pageview and REST API analytics, call `trackPageviewOrRESTCall` with the incoming Node.js request and response.

```ts
knownAgents.trackPageviewOrRESTCall(request, response)
```

For REST APIs that return [ACP (Agentic Commerce Protocol)](https://www.agenticcommerce.dev/) or [UCP (Universal Commerce Protocol)](https://ucp.dev/) commerce metadata, include the response body:

```ts
knownAgents.trackPageviewOrRESTCall(request, response, {
    restACPResponseBody: acpResponseBody
})
```

```ts
knownAgents.trackPageviewOrRESTCall(request, response, {
    restUCPResponseBody: ucpResponseBody
})
```

The SDK waits for the response to finish, then sends status, headers, duration, and any commerce metadata. Sensitive headers are filtered automatically.

#### Use Middleware if Possible

If your framework supports middleware, call `trackPageviewOrRESTCall` there so pageviews and REST calls are tracked from a single place. [MCP](https://modelcontextprotocol.io/) requests are skipped automatically.

```ts
import express from "express"
import { KnownAgents } from "@knownagents/sdk"

const app = express()
const knownAgents = new KnownAgents("YOUR_ACCESS_TOKEN")

app.use((request, response, next) => {
    knownAgents.trackPageviewOrRESTCall(request, response)
    next()
})

app.get("/", (request, response) => {
    response.send("Hello, world!")
})

app.listen(3000, () => console.log("Server running on port 3000"))
```

### Track MCP Calls

For [MCP](https://modelcontextprotocol.io/) servers that use `StreamableHTTPServerTransport`, call `trackMCPCall` after connecting the transport and before the transport handles the request.

For MCP calls that return [ACP](https://www.agenticcommerce.dev/) or [UCP](https://ucp.dev/) commerce metadata, the SDK captures the relevant currency and total amount automatically.

Use this order in your MCP HTTP handler:

```ts
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"

const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined
})

await mcpServer.connect(transport)
knownAgents.trackMCPCall(request, response, transport)
await transport.handleRequest(request, response, parsedBody)
```

Use `trackVisits` instead if the same transport instance handles concurrent requests.

### Batching

For high-traffic websites, batch multiple visits together and send them periodically (e.g. every 30 seconds) using `trackVisits`. `trackVisits` can also batch MCP visits; if you do that, include the MCP fields in each `VisitRequest` and do not also call `trackMCPCall` for the same requests. Here's an Express example:

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

If your website is correctly connected, you should see visits from the Known Agent in the realtime timeline within a few seconds.

## How To Set Up Automatic Robots.txt ([Full Docs](https://knownagents.com/docs/robots-txt))

Protect sensitive content from unwanted access and scraping. Generate a continuously updating robots.txt that stays up to date with [all current and future bots](https://knownagents.com/agents) in the specified categories automatically.

Use the `generateRobotsTXT` function. Select which `AgentType`s you want to block, and a string specifying which URLs are disallowed (e.g. `"/"` to disallow all paths).

```ts
import { AgentType } from "@knownagents/sdk"

const robotsTxt = await knownAgents.generateRobotsTXT([
    AgentType.AIDataScraper,
    AgentType.AIDataProvider,
    AgentType.Scraper,
    AgentType.SEOCrawler
], "/")
```

The return value is a plain text robots.txt string. Generate a `robotsTxt` periodically (e.g. once per day), then cache and serve it from your website's `/robots.txt` endpoint.

## How To Use Agent Identification ([Full Docs](https://knownagents.com/docs/identification))

Use the `identifyAgent` and `identifyAgents` functions to identify and verify [AI agents and bots](https://knownagents.com/agents) from network requests using Web Bot Auth (HTTP message signatures), IP matching, or other available methods. This can be useful for implementing access policies based on verified agent identity or enriching your own datasets.

### Identify a Single Request

Call `identifyAgent` with the incoming request.

```ts
const identification = await knownAgents.identifyAgent(request)

if (identification.result === "verified") {
    handleVerifiedAgent(identification)
} else if (identification.result === "verification_failed") {
    handleFailedVerification(identification)
}
```

### Identify Multiple Requests

Use `identifyAgents` to identify multiple requests at once:

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

The functions return an object (or array of objects) with the following fields:

- `id`: The identifier from the request (if provided)
- `result`: The identification result:
  - `"verified"`: The agent is identified and verified
  - `"verification_failed"`: The agent was identified but could not be verified
  - `"unknown_agent"`: The agent is not in our database
  - `"not_verifiable"`: The agent cannot be verified (no verification method available)
- `agent_id`: The unique ID of the agent (if identified)
- `agent_token`: The name of the agent (e.g. `"Googlebot"`) (if identified)
- `agent_url`: The documentation URL of the agent (if identified)
- `agent_type_name`: The type of agent (e.g. `"AI Agent"`) (if identified)
- `operator_name`: The company behind the agent (e.g. `"Google"`) (if identified)

## Requirements

TypeScript >= 4.7 is supported.

The following runtimes are supported:

- Node.js 18 LTS or later ([non-EOL](https://endoflife.date/nodejs))

## Support

Please [open an issue](https://github.com/knownagents/node-sdk/issues) with questions, bugs, or suggestions.
