import { experimental_createMCPClient, type ToolSet } from "ai"

type McpClient = Awaited<ReturnType<typeof experimental_createMCPClient>>

type McpServerConfig = {
  url: string
  headers?: Record<string, string>
}

export type McpToolsets = {
  tools: ToolSet
  clients: McpClient[]
}

/**
 * Reads `MCP_SERVERS` (a JSON array of `{ url, headers? }`) and connects to
 * each MCP server over SSE, merging every server's tools into one toolset.
 *
 * Zero-config safe: if the env var is unset, empty, or malformed, this returns
 * an empty toolset with no clients — so the agent route works with no MCP
 * servers configured and the build never needs any MCP env at all.
 *
 * The caller owns closing the returned clients once the stream finishes.
 */
export async function getMcpToolsets(): Promise<McpToolsets> {
  const raw = process.env.MCP_SERVERS
  if (!raw) return { tools: {}, clients: [] }

  let servers: McpServerConfig[]
  try {
    const parsed = JSON.parse(raw)
    servers = Array.isArray(parsed) ? parsed : []
  } catch {
    console.warn("[mcp] MCP_SERVERS is not valid JSON — skipping MCP tools")
    return { tools: {}, clients: [] }
  }

  const tools: ToolSet = {}
  const clients: McpClient[] = []

  for (const server of servers) {
    if (!server?.url) continue
    try {
      const client = await experimental_createMCPClient({
        transport: {
          type: "sse",
          url: server.url,
          headers: server.headers,
        },
      })
      const serverTools = await client.tools()
      Object.assign(tools, serverTools)
      clients.push(client)
    } catch (error) {
      // One bad server must never break the route.
      console.warn(`[mcp] Failed to connect to ${server.url}:`, error)
    }
  }

  return { tools, clients }
}

/** Closes every MCP client, ignoring individual failures. */
export async function closeMcpClients(clients: McpClient[]): Promise<void> {
  await Promise.all(
    clients.map((client) =>
      client.close().catch((error) => {
        console.warn("[mcp] Failed to close client:", error)
      })
    )
  )
}
