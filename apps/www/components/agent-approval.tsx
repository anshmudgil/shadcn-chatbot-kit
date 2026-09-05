"use client"

import { Check, ShieldAlert, X } from "lucide-react"

import { Button } from "@/registry/new-york/ui/button"

export type AgentApprovalProps = {
  /** The tool awaiting approval (e.g. "sendEmail"). */
  toolName: string
  /** The pending tool call id, needed to return the approval result. */
  toolCallId: string
  /** The arguments the model wants to run the tool with. */
  args: Record<string, unknown>
  onApprove: (toolCallId: string) => void
  onReject: (toolCallId: string) => void
}

/**
 * Human-in-the-loop approval card. Shown when the agent calls a sensitive tool
 * (defined without `execute`) that halts awaiting explicit user confirmation.
 */
export function AgentApproval({
  toolName,
  toolCallId,
  args,
  onApprove,
  onReject,
}: AgentApprovalProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm">
      <div className="flex items-center gap-2 font-medium text-amber-600 dark:text-amber-500">
        <ShieldAlert className="h-4 w-4" />
        <span>
          Approval required to run <code className="font-mono">{toolName}</code>
        </span>
      </div>

      <pre className="overflow-x-auto whitespace-pre-wrap rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs">
        {JSON.stringify(args, null, 2)}
      </pre>

      <div className="flex gap-2">
        <Button size="sm" onClick={() => onApprove(toolCallId)}>
          <Check className="mr-1 h-4 w-4" />
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onReject(toolCallId)}
        >
          <X className="mr-1 h-4 w-4" />
          Reject
        </Button>
      </div>
    </div>
  )
}
