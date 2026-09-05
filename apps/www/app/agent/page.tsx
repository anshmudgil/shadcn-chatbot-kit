"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import { loadThread, newThreadId } from "@/lib/agent/thread-store"
import { AgentChat } from "@/components/agent-chat"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/default/ui/select"
import { Button } from "@/registry/new-york/ui/button"

// Available models (Groq), mirrored from the demo page.
const MODELS = [
  { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B" },
  { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B" },
]

const ACTIVE_THREAD_KEY = "agent-thread:active"

export default function AgentPage() {
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id)
  // `null` until the client resolves the active thread id, so SSR and the
  // first client render agree (avoids hydration mismatch).
  const [threadId, setThreadId] = useState<string | null>(null)

  useEffect(() => {
    let id = window.localStorage.getItem(ACTIVE_THREAD_KEY)
    if (!id) {
      id = newThreadId()
      window.localStorage.setItem(ACTIVE_THREAD_KEY, id)
    }
    setThreadId(id)
  }, [])

  const startNewThread = () => {
    const id = newThreadId()
    window.localStorage.setItem(ACTIVE_THREAD_KEY, id)
    setThreadId(id)
  }

  return (
    <div className="relative min-h-screen w-full bg-background p-4">
      {/* Navigation & controls */}
      <div className="absolute left-4 top-4 z-10 flex gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/">← Back to site</Link>
        </Button>
        <Button variant="outline" size="sm" onClick={startNewThread}>
          New thread
        </Button>
      </div>

      <div className="absolute right-4 top-4 z-10">
        <Select value={selectedModel} onValueChange={setSelectedModel}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select Model" />
          </SelectTrigger>
          <SelectContent>
            {MODELS.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Agent chat */}
      <div className="mx-auto h-[calc(100vh-2rem)] w-full max-w-4xl">
        {threadId && (
          <AgentChat
            key={threadId}
            model={selectedModel}
            threadId={threadId}
            initialMessages={loadThread(threadId)}
            className="h-full"
          />
        )}
      </div>
    </div>
  )
}
