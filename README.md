# Known Agents SDK

[![NPM version](https://img.shields.io/npm/v/@knownagents/sdk.svg)](https://npmjs.org/package/@knownagents/sdk)

This library provides convenient access to [Known Agents](https://knownagents.com/) from server-side TypeScript or JavaScript.

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

Get realtime insight into the hidden ecosystem of [crawlers, scrapers, AI agents, and other bots](https://knownagents.com/agents) browsing your website. Measure human traffic coming from AI chat and search platforms like ChatGPT, Perplexity, and Gemini.

To collect this data, call `trackVisit` for each incoming request in the endpoints where you serve your pages.

```ts
knownAgents.trackVisit(request)
```

For richer analytics, include the response and duration:

```ts
knownAgents.trackVisit(request, response, responseDurationInMilliseconds)
```

### Use Middleware if Possible

If you can, add this in middleware to track incoming requests to all pages from a single place.

Here's an example with Express, but you can apply this same technique with other frameworks:

```ts
import express from "express"
import { KnownAgents } from "@knownagents/sdk"

const app = express()
const knownAgents = new KnownAgents("YOUR_ACCESS_TOKEN")

app.use((req, res, next) => {
    const start = Date.now()
    
    res.on('finish', () => {
        const duration = Date.now() - start
        knownAgents.trackVisit(req, res, duration)
    })
    
    next()
})

app.get("/", (req, res) => {
    res.send("Hello, world!")
})

app.listen(3000, () => console.log("Server running on port 3000"))
```

### Test Your Integration

- Open your project's settings page
- Click **Send a Test Visit**
- Click **Realtime**

If your website is correctly connected, you should see visits from the Known Agent in the realtime timeline within a few seconds.

## How To Set Up Agent Verification ([Full Docs](https://knownagents.com/docs/verification))

Identify and verify agents from network requests using Web Bot Auth (HTTP message signatures) or other methods like IP matching. This helps you distinguish legitimate bots from impersonators.

Use the `verifyAgent` function to check if a request is from a legitimate agent by passing in the incoming request object.

```ts
const verification = await knownAgents.verifyAgent(request)

if (verification.result === "verified") {
    // Agent is legitimate
} else if (verification.result === "verification_failed") {
    // Agent is not legitimate
}
```

The function returns an object with the following fields:

- `result`: The verification result:
  - `"verified"`: The agent is identified and verified
  - `"verification_failed"`: The agent was identified but could not be verified
  - `"unknown_agent"`: The agent is not in our database
  - `"not_verifiable"`: The agent cannot be verified (no verification method available)
- `agent_id`: The unique ID of the agent (if identified)
- `agent_token`: The name of the agent (e.g. `"Googlebot"`) (if identified)
- `agent_url`: The documentation URL of the agent (if identified)
- `agent_type_name`: The type of agent (e.g. `"AI Agent"`) (if identified)
- `operator_name`: The company behind the agent (e.g. `"Google"`) (if identified)

## How To Set Up Automatic Robots.txt ([Full Docs](https://knownagents.com/docs/robots-txt))

Protect sensitive content from unwanted access and scraping. Generate a continuously updating robots.txt that stays up to date with [all current and future bots](https://knownagents.com/agents) in the specified categories automatically.

Use the `generateRobotsTxt` function. Select which `AgentType`s you want to block, and a string specifying which URLs are disallowed (e.g. `"/"` to disallow all paths).

```ts
const robotsTxt = await knownAgents.generateRobotsTxt([
  AgentType.AIDataScraper,
  AgentType.Scraper,
  AgentType.IntelligenceGatherer,
  AgentType.SEOCrawler
  // ...
], "/")

```

The return value is a plain text robots.txt string. Generate a `robotsTxt` periodically (e.g. once per day), then cache and serve it from your website's `/robots.txt` endpoint.

## Requirements

TypeScript >= 4.7 is supported.

The following runtimes are supported:

- Node.js 18 LTS or later ([non-EOL](https://endoflife.date/nodejs)) versions.

## Support

Please [open an issue](https://github.com/knownagents/node-sdk/issues) with questions, bugs, or suggestions.