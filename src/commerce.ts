import type { IncomingMessage } from "http"
import { getIsProbablyACPCall, getIsUCPCall } from "./headers"
import type { RESTACPResponseBody, RESTUCPResponseBody } from "./types"

interface MCPCommerceResponseBody {
    result?: {
        currency?: string
        totals?: {
            type?: string
            amount?: number
        }[]
        structuredContent?: {
            currency?: string
            totals?: {
                type?: string
                amount?: number
            }[]
        }
    }
}

export function getRESTACPCurrencyIfPossible(restACPResponseBody: RESTACPResponseBody): string | undefined {
    return restACPResponseBody?.currency
}

export function getRESTACPTotalAmountIfPossible(restACPResponseBody: RESTACPResponseBody): number | undefined {
    return restACPResponseBody?.totals?.find((total) => {
        return total.type == "total"
    })?.amount
}

export function getMCPACPCurrencyIfPossible(request: IncomingMessage, mcpResponseBody: MCPCommerceResponseBody): string | undefined {
    const isProbablyACP = !getIsUCPCall(request.headers) && getIsProbablyACPCall(request.headers)
    return isProbablyACP ? mcpResponseBody.result?.currency : undefined
}

export function getMCPACPTotalAmountIfPossible(request: IncomingMessage, mcpResponseBody: MCPCommerceResponseBody): number | undefined {
    const isProbablyACP = !getIsUCPCall(request.headers) && getIsProbablyACPCall(request.headers)
    return isProbablyACP
        ? mcpResponseBody.result?.totals?.find((total) => {
              return total.type == "total"
          })?.amount
        : undefined
}

export function getRESTUCPCurrencyIfPossible(restUCPResponseBody: RESTUCPResponseBody): string | undefined {
    return restUCPResponseBody?.currency
}

export function getRESTUCPTotalAmountIfPossible(restUCPResponseBody: RESTUCPResponseBody): number | undefined {
    return restUCPResponseBody?.totals?.find((total) => {
        return total.type == "total"
    })?.amount
}

export function getMCPUCPCurrencyIfPossible(request: IncomingMessage, mcpResponseBody: MCPCommerceResponseBody): string | undefined {
    const isUCP = getIsUCPCall(request.headers)
    return isUCP ? mcpResponseBody.result?.structuredContent?.currency : undefined
}

export function getMCPUCPTotalAmountIfPossible(request: IncomingMessage, mcpResponseBody: MCPCommerceResponseBody): number | undefined {
    const isUCP = getIsUCPCall(request.headers)
    return isUCP
        ? mcpResponseBody.result?.structuredContent?.totals?.find((total) => {
              return total.type == "total"
          })?.amount
        : undefined
}
