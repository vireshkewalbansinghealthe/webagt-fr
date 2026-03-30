"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, SignInButton } from "@clerk/nextjs";
import { WORKER_URL } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Loader2, Users, CheckCircle2, XCircle, Mail } from "lucide-react";
import Link from "next/link";
import { use } from "react";

interface InviteDetails {
  projectId: string;
  projectName: string;
  invitedEmail: string;
  inviterName: string;
  role: "editor" | "viewer";
  expiresAt: string;
}

export default function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const { isSignedIn, isLoaded, getToken } = useAuth();

  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "accepting" | "accepted" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  // Fetch invite details on mount (public endpoint — no auth needed)
  useEffect(() => {
    async function fetchInvite() {
      try {
        const res = await fetch(`${WORKER_URL}/api/invites/${token}`);
        if (!res.ok) {
          const body = (await res.json()) as { error?: string };
          setErrorMessage(body.error ?? "Invitation not found or expired.");
          setStatus("error");
          return;
        }
        const data = (await res.json()) as InviteDetails;
        setInvite(data);
        setStatus("ready");
      } catch {
        setErrorMessage("Failed to load invitation. Please try again.");
        setStatus("error");
      }
    }
    fetchInvite();
  }, [token]);

  async function handleAccept() {
    if (!isSignedIn) return;
    setStatus("accepting");
    try {
      const authToken = await getToken();
      const res = await fetch(`${WORKER_URL}/api/invites/${token}/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setErrorMessage(body.error ?? "Failed to accept invitation.");
        setStatus("error");
        return;
      }
      const data = (await res.json()) as { projectId: string };
      setStatus("accepted");
      // Redirect to the project after a short delay
      setTimeout(() => {
        router.push(`/project/${data.projectId}`);
      }, 1500);
    } catch {
      setErrorMessage("Failed to accept invitation. Please try again.");
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <div className="size-10 overflow-hidden rounded-xl border border-white/10 bg-black shadow-lg">
              <img src="/logo.svg" alt="WebAGT" className="size-full object-cover" />
            </div>
            <span className="font-outfit text-xl font-bold text-white tracking-tight">WebAGT</span>
          </Link>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-8 shadow-2xl">
          {status === "loading" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="size-8 animate-spin text-blue-400" />
              <p className="text-sm text-white/50">Loading invitation…</p>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="size-14 rounded-full bg-red-500/10 flex items-center justify-center">
                <XCircle className="size-7 text-red-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Invitation unavailable</h2>
              <p className="text-sm text-white/50">{errorMessage}</p>
              <Button asChild variant="outline" className="mt-2 border-white/10 text-white/70 hover:text-white hover:border-white/30">
                <Link href="/">Go to WebAGT</Link>
              </Button>
            </div>
          )}

          {status === "accepted" && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="size-14 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="size-7 text-green-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">You&apos;re in!</h2>
              <p className="text-sm text-white/50">Redirecting you to the project…</p>
              <Loader2 className="size-5 animate-spin text-white/30 mt-2" />
            </div>
          )}

          {(status === "ready" || status === "accepting") && invite && (
            <>
              {/* Icon */}
              <div className="flex justify-center mb-6">
                <div className="size-14 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Users className="size-7 text-blue-400" />
                </div>
              </div>

              <h2 className="text-xl font-semibold text-white text-center mb-1">
                Project Invitation
              </h2>
              <p className="text-sm text-white/50 text-center mb-6">
                <strong className="text-white/80">{invite.inviterName}</strong> has invited you to collaborate
              </p>

              {/* Project info */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-6 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40 uppercase tracking-wider">Project</span>
                  <span className="text-sm font-medium text-white">{invite.projectName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40 uppercase tracking-wider">Your role</span>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      invite.role === "editor"
                        ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                        : "bg-white/10 text-white/60 border border-white/10"
                    }`}
                  >
                    {invite.role === "editor" ? "Editor" : "Viewer"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40 uppercase tracking-wider">Invited to</span>
                  <span className="text-xs text-white/50 flex items-center gap-1">
                    <Mail className="size-3" />
                    {invite.invitedEmail}
                  </span>
                </div>
              </div>

              {/* CTA */}
              {isLoaded && !isSignedIn ? (
                <div className="space-y-3">
                  <p className="text-xs text-white/40 text-center mb-3">
                    Sign in or create an account to accept this invitation
                  </p>
                  <SignInButton mode="modal" forceRedirectUrl={`/invite/${token}`}>
                    <Button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium">
                      Sign in to accept
                    </Button>
                  </SignInButton>
                </div>
              ) : (
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium"
                  onClick={handleAccept}
                  disabled={status === "accepting"}
                >
                  {status === "accepting" ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Accepting…
                    </>
                  ) : (
                    "Accept Invitation"
                  )}
                </Button>
              )}

              <p className="text-xs text-white/30 text-center mt-4">
                Expires {new Date(invite.expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
