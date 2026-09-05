import { groq } from "@ai-sdk/groq"
import { convertToCoreMessages, streamText } from "ai"

import { closeMcpClients, getMcpToolsets } from "@/lib/agent/mcp"
import { agentTools } from "@/lib/agent/tools"

export const maxDuration = 30

const DEFAULT_MODEL = "llama-3.3-70b-versatile"

export async function POST(req: Request) {
  const { messages, model = DEFAULT_MODEL } = await req.json()

  // Optional, config-driven MCP tools. Empty + safe when MCP_SERVERS is unset.
  const { tools: mcpTools, clients } = await getMcpToolsets()

  // Local tools first so external MCP tools can never shadow the HITL tool.
  const tools = { ...mcpTools, ...agentTools }

  const result = streamText({
    model: groq(model),
    messages: [
      { role: "system", content: AGENT_SYSTEM_PROMPT },
      ...convertToCoreMessages(messages),
    ],
    // A real agentic loop: plan, call tools, observe, continue.
    maxSteps: 10,
    tools,
    // Close MCP connections once the whole response (incl. tool steps) is done,
    // so streamed tool output is never truncated.
    onFinish: async () => {
      await closeMcpClients(clients)
    },
    // onFinish does not fire when the stream errors (e.g. a missing/invalid
    // key 401s). Close here too so MCP connections never leak on the error path.
    onError: async () => {
      await closeMcpClients(clients)
    },
  })

  // Forward reasoning parts to the client when the chosen model emits them.
  // (Groq's llama-3.3-70b default is not a reasoning model, so this is a no-op
  // for it; it renders reasoning only when a reasoning-capable model is used.)
  return result.toDataStreamResponse({
    sendReasoning: true,
  })
}

const AGENT_SYSTEM_PROMPT = `You are an agentic AI assistant built on the shadcn-chatbot-kit. You operate as an autonomous agent that can plan and take multiple steps to complete a task, using tools when they help.

How you work:
1. Plan first. For any multi-step request, briefly decompose it into steps, then execute them one at a time, observing each tool result before deciding the next step.
2. Use tools deliberately — only when they are actually needed to complete the task or when the user explicitly asks. Never call tools in response to unclear or random input (e.g. "asdfgh"); ask for clarification instead.
3. Human-in-the-loop for sensitive actions. The \`sendEmail\` tool (and any future sensitive tool) REQUIRES explicit user approval. When you call it, it will pause and wait for the user to approve or reject. Do NOT claim an email was sent until the approval result comes back confirming it. If the user rejects, acknowledge that and do not retry without new instruction.
4. Be transparent. Explain what you're doing and why, and summarize results clearly when you finish.
5. Refuse harmful, malicious, or privacy-violating requests and explain why.

Keep responses focused and well-formatted (use bold, lists, and code blocks where they aid clarity).`
