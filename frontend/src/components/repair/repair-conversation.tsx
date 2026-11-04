"use client";

import { useEffect, useState, useRef, type FormEvent } from "react";
import {
  AlertCircle,
  Bot,
  LoaderCircle,
  MessageCircle,
  Send,
  GraphStar,
  User,
} from "lucide-react";

import {
  getRepairConversation,
  sendRepairMessage,
} from "@/lib/api";

import type { ConversationMessage } from "@/types/repair";

interface RepairConversationProps {
  jobId: string;
}

const SUGGESTED_QUESTIONS = [
  "Explain the root cause of this bug.",
  "Walk me through the patch that was applied.",
  "What exactly did the tests verify?",
  "Are there any limitations or risks remaining?",
];

export default function RepairConversation({
  jobId,
}: RepairConversationProps) {
  const pendingRequestRef = useRef<{
    question: string;
    requestId: string;
    } | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadHistory() {
      setLoadingHistory(true);
      setError(null);

      try {
        const history = await getRepairConversation(
          jobId,
          controller.signal
        );

        if (!controller.signal.aborted) {
          setMessages(history);
        }
      } catch (err) {
        if (controller.signal.aborted) return;

        setError(
          err instanceof Error
            ? err.message
            : "Could not load conversation history."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoadingHistory(false);
        }
      }
    }

    void loadHistory();

    return () => controller.abort();
  }, [jobId, reloadKey]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  const question = input.trim();

  if (!question || sending || question.length > 4000) return;

  setSending(true);
  setError(null);
  setInput("");

  try {
    const pending =
      pendingRequestRef.current?.question === question
        ? pendingRequestRef.current
        : {
            question,
            requestId: crypto.randomUUID(),
          };

    pendingRequestRef.current = pending;

    const response = await sendRepairMessage(
      jobId,
      question,
      pending.requestId
    );

    pendingRequestRef.current = null;

    setMessages((current) => [
      ...current,
      ...response.messages,
    ]);
  } catch (err) {
    setInput(question);

    setError(
      err instanceof Error
        ? err.message
        : "The assistant could not process your question."
    );
  } finally {
    setSending(false);
  }
}

  function formatTime(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    return new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  return (
    <section
        id="repair-conversation"
        className="overflow-hidden rounded-2xl border border-[#EAE7E2] bg-white shadow-sm"
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#EAE7E2] px-5 py-4 sm:px-6">
        <div className="flex size-10 items-center justify-center rounded-xl bg-[#F0EDFF] text-[#7165C5]">
          <MessageCircle className="size-5" />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-[#292724]">
            Ask about this repair
          </h2>
          <p className="mt-0.5 text-[11px] text-[#89847D]">
            Understand the diagnosis, patch and verification evidence.
          </p>
        </div>

        <span className="hidden items-center gap-1.5 rounded-full border border-[#EAE7E2] px-2.5 py-1 text-[10px] font-medium text-[#817B73] sm:inline-flex">
          <span className="size-1.5 rounded-full bg-green-500" />
          Read-only
        </span>
      </div>

      {/* Conversation */}
      <div className="max-h-[520px] min-h-[260px] space-y-5 overflow-y-auto p-4 sm:p-6">
        {loadingHistory ? (
          <div className="flex min-h-48 items-center justify-center gap-2 text-xs text-[#89847D]">
            <LoaderCircle className="size-4 animate-spin" />
            Loading conversation...
          </div>
        ) : (
          <>
            {messages.length === 0 && (
              <div className="py-5">
                <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#F0EDFF] text-[#7165C5]">
                  <GraphStar className="size-5" />
                </div>

                <h3 className="mt-4 text-center text-sm font-semibold text-[#292724]">
                  Your repair, explained.
                </h3>

                <p className="mx-auto mt-2 max-w-sm text-center text-xs leading-relaxed text-[#89847D]">
                  Ask questions about what ProofLoop discovered, why the
                  patch works, and what the test results actually prove.
                </p>

                <div className="mx-auto mt-6 grid max-w-xl gap-2 sm:grid-cols-2">
                  {SUGGESTED_QUESTIONS.map((question) => (
                    <button
                      key={question}
                      type="button"
                      disabled={sending}
                      onClick={() => setInput(question)}
                      className="rounded-xl border border-[#EAE7E2] bg-[#FCFBF9] px-3 py-3 text-left text-xs leading-relaxed text-[#514D47] transition-colors hover:border-[#C9C1F1] hover:bg-[#F8F6FF] disabled:opacity-50"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => {
              const isAssistant = message.role === "assistant";

              return (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    isAssistant ? "items-start" : "flex-row-reverse items-start"
                  }`}
                >
                  <div
                    className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                      isAssistant
                        ? "bg-[#F0EDFF] text-[#7165C5]"
                        : "bg-[#F4F1EC] text-[#71665A]"
                    }`}
                  >
                    {isAssistant ? (
                      <Bot className="size-4" />
                    ) : (
                      <User className="size-4" />
                    )}
                  </div>

                  <div
                    className={`min-w-0 max-w-[85%] space-y-1 ${
                      isAssistant ? "" : "text-right"
                    }`}
                  >
                    <div
                      className={`inline-block rounded-2xl px-4 py-3 text-left text-xs leading-relaxed ${
                        isAssistant
                          ? "rounded-tl-sm bg-[#F8F6FF] text-[#514D68]"
                          : "rounded-tr-sm bg-[#F4F1EC] text-[#514D47]"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">
                        {message.content}
                      </p>
                    </div>

                    <p className="px-1 text-[10px] text-[#A39D94]">
                      {isAssistant ? "Repair Assistant" : "You"}
                      {message.created_at && (
                        <> · {formatTime(message.created_at)}</>
                      )}
                    </p>
                  </div>
                </div>
              );
            })}

            {sending && (
              <div className="flex items-start gap-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-[#F0EDFF] text-[#7165C5]">
                  <Bot className="size-4" />
                </div>

                <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-[#F8F6FF] px-4 py-3 text-xs text-[#7165C5]">
                  <LoaderCircle className="size-3.5 animate-spin" />
                  Analyzing repair evidence...
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          className="mx-4 mb-3 flex items-start gap-2 rounded-xl border border-[#F0D4D1] bg-[#FFF8F7] p-3 text-xs text-[#9F3D35] sm:mx-6"
          role="alert"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p>{error}</p>
            {!loadingHistory && messages.length === 0 && (
              <button
                type="button"
                onClick={() => setReloadKey((value) => value + 1)}
                className="mt-1 font-semibold underline underline-offset-2"
              >
                Retry loading history
              </button>
            )}
          </div>
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-[#EAE7E2] p-4 sm:p-5"
      >
        <div className="flex items-end gap-2 rounded-xl border border-[#D0CBC4] bg-[#FCFBF9] p-2 transition-colors focus-within:border-[#433075]">
          <textarea
            id="repair-question-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask anything about this repair..."
            rows={2}
            maxLength={4000}
            disabled={loadingHistory || sending}
            style={{ outline: "none", boxShadow: "none" }}
            className="max-h-32 min-h-12 flex-1 resize-y bg-transparent px-2 py-2 text-xs leading-relaxed text-[#292724] outline-none placeholder:text-[#AAA49C] disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={
              loadingHistory ||
              sending ||
              !input.trim() ||
              input.length > 4000
            }
            aria-label="Send message"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#7165C5] text-white transition-colors hover:bg-[#5F53B3] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between gap-3 px-1">
          <p className="text-[10px] text-[#A39D94]">
            Answers are grounded in this repair&apos;s report and evidence.
          </p>
          <span className="shrink-0 text-[10px] tabular-nums text-[#A39D94]">
            {input.length}/4000
          </span>
        </div>
      </form>
    </section>
  );
}