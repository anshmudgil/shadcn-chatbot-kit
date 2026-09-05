"use client"

import { useEffect, useMemo } from "react"
import { useChat, type Message, type UseChatOptions } from "@ai-sdk/react"
import type { ToolInvocation } from "ai"

import { saveThread } from "@/lib/agent/thread-store"
import { HITL_TOOLS } from "@/lib/agent/tools"
import { cn } from "@/lib/utils"
import { transcribeAudio } from "@/lib/utils/audio"
import { AgentApproval } from "@/components/agent-approval"
import { Chat } from "@/registry/default/ui/chat"

// Suggestions shown when the agent chat is empty. Includes a multi-step
// prompt and a sendEmail prompt (which triggers the HITL approval gate).
const DEFAULT_SUGGESTIONS = [
  "What is the weather in Tokyo and London? Compare them.",
  "Plan a 3-step approach to learn TypeScript, then summarize it.",
  "Draft and send an email to alex@example.com about tomorrow's 10am meeting.",
]

type PendingApproval = {
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
}

const HITL_SET = new Set<string>(HITL_TOOLS)

/**
 * Finds HITL tool calls awaiting approval on the LAST assistant message only.
 *
 * Only `state === "call"` counts as pending: that is a finalized tool call with
 * complete args and no result yet. `partial-call` is still streaming its args,
 * so approving it would fire `addToolResult` for a call the SDK has not
 * finalized. Scanning only the last assistant message avoids re-surfacing a
 * card for an already-resolved call earlier in the history.
 */
function findPendingApprovals(messages: Message[]): PendingApproval[] {
  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant")
  if (!lastAssistant) return []

  const invocations = [
    ...(lastAssistant.parts ?? [])
      .filter((p) => p.type === "tool-invocation")
      .map((p) => (p as { toolInvocation: ToolInvocation }).toolInvocation),
    ...((lastAssistant.toolInvocations as ToolInvocation[]) ?? []),
  ]

  const pending: PendingApproval[] = []
  for (const inv of invocations) {
    if (!inv || inv.state !== "call") continue
    if (!HITL_SET.has(inv.toolName)) continue
    // Dedupe by toolCallId (parts + legacy array can overlap).
    if (pending.some((p) => p.toolCallId === inv.toolCallId)) continue
    pending.push({
      toolCallId: inv.toolCallId,
      toolName: inv.toolName,
      args: (inv.args ?? {}) as Record<string, unknown>,
    })
  }

  return pending
}

type AgentChatProps = {
  /** ID of the model to use for this agent session. */
  model: string
  /** Stable thread id used to persist/resume the conversation. */
  threadId: string
  /** Messages to seed the chat with (e.g. a restored thread). */
  initialMessages?: UseChatOptions["initialMessages"]
  className?: string
}

/**
 * Agent-native chat: a multi-step agentic loop (`maxSteps: 10`) against
 * `/api/agent`, with a human-in-the-loop approval gate for sensitive tools and
 * localStorage-backed thread memory.
 */
export function AgentChat({
  model,
  threadId,
  initialMessages,
  className,
}: AgentChatProps) {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    append,
    stop,
    status,
    setMessages,
    addToolResult,
  } = useChat({
    id: threadId,
    initialMessages,
    api: "/api/agent",
    body: { model },
    // Auto-resubmit after a client tool result so the agent loop continues.
    maxSteps: 10,
  })

  const isLoading = status === "submitted" || status === "streaming"

  // Persist only once the stream settles, not on every streamed token — avoids
  // O(n) localStorage writes per response (and blowing the ~5MB quota).
  useEffect(() => {
    if (status === "ready" && messages.length > 0) {
      saveThread(threadId, messages)
    }
  }, [threadId, status, messages])

  const pendingApprovals = useMemo(
    () => findPendingApprovals(messages),
    [messages]
  )

  const handleApprove = (toolCallId: string) => {
    addToolResult({
      toolCallId,
      result: {
        approved: true,
        status: "sent",
        messageId: `msg_${toolCallId.slice(0, 8)}`,
        note: "User approved. Email sent (demo).",
      },
    })
  }

  const handleReject = (toolCallId: string) => {
    addToolResult({
      toolCallId,
      result: {
        approved: false,
        status: "cancelled",
        reason: "User rejected the action.",
      },
    })
  }

  return (
    <div className={cn("flex", "flex-col", "w-full", className)}>
      <Chat
        className="grow"
        messages={messages}
        handleSubmit={handleSubmit}
        input={input}
        handleInputChange={handleInputChange}
        isGenerating={isLoading}
        stop={stop}
        append={append}
        setMessages={setMessages}
        transcribeAudio={transcribeAudio}
        suggestions={DEFAULT_SUGGESTIONS}
      />

      {pendingApprovals.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {pendingApprovals.map((approval) => (
            <AgentApproval
              key={approval.toolCallId}
              toolName={approval.toolName}
              toolCallId={approval.toolCallId}
              args={approval.args}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ))}
        </div>
      )}
    </div>
  )
}
