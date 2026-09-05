import { tool, type ToolSet } from "ai"
import { z } from "zod"

import { delay } from "@/lib/delay"
import { getWeather } from "@/lib/weather"

/**
 * Names of tools that must NOT auto-execute. These are defined without an
 * `execute` function so the agent step halts and the call surfaces to the
 * client for human approval before anything irreversible happens.
 */
export const HITL_TOOLS = ["sendEmail"] as const

/**
 * Local (non-MCP) tools available to the agent.
 *
 * `weather` and `delay` execute server-side immediately. `sendEmail` is a
 * human-in-the-loop (HITL) tool: it has no `execute`, so the AI SDK stops the
 * step with a pending tool-call that the UI renders as an approval prompt.
 */
export const agentTools: ToolSet = {
  weather: tool({
    description: "Look up the current weather in a given location",
    parameters: z.object({
      location: z.string().describe("The location to get the weather for"),
    }),
    execute: async ({ location }) => {
      return await getWeather(location)
    },
  }),
  delay: tool({
    description: "Pauses the agent for a given duration in seconds",
    parameters: z.object({
      duration: z
        .number()
        .positive()
        .describe("The duration to pause in seconds"),
    }),
    execute: async ({ duration }) => {
      return await delay(duration)
    },
  }),
  // HITL: no `execute` — requires explicit user approval before "sending".
  sendEmail: tool({
    description:
      "Send an email to a recipient. This is a sensitive action that REQUIRES explicit user approval before it runs. Never assume the email was sent until approval is granted.",
    parameters: z.object({
      to: z.string().describe("Recipient email address"),
      subject: z.string().describe("Email subject line"),
      body: z.string().describe("Email body content"),
    }),
  }),
}

/**
 * Returns the subset of a toolset that requires human confirmation — i.e.
 * tools defined without an `execute` function.
 */
export function getToolsRequiringConfirmation(tools: ToolSet): string[] {
  return Object.keys(tools).filter(
    (name) =>
      typeof (tools[name] as { execute?: unknown }).execute !== "function"
  )
}
