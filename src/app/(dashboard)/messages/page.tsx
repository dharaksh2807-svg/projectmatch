"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { WhatsAppChatInterface } from "@/components/chat/WhatsAppChatInterface";
import { Skeleton } from "@/components/ui/skeleton";

function MessagesContent() {
  const searchParams = useSearchParams();
  const initialId = searchParams.get("c") || searchParams.get("conversationId");
  const targetUserId = searchParams.get("userId") || searchParams.get("u");
  const targetProjectId = searchParams.get("projectId") || searchParams.get("p");

  return (
    <WhatsAppChatInterface
      initialConversationId={initialId}
      targetUserId={targetUserId}
      targetProjectId={targetProjectId}
    />
  );
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100dvh-7.5rem)] md:h-[100dvh] w-full items-center justify-center bg-zinc-950">
          <div className="space-y-4 text-center">
            <Skeleton className="h-10 w-48 mx-auto rounded-xl" />
            <Skeleton className="h-4 w-64 mx-auto rounded" />
          </div>
        </div>
      }
    >
      <MessagesContent />
    </Suspense>
  );
}
