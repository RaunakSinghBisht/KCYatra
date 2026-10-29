import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ArrowLeft, Loader2, Phone, ScrollText, ShieldCheck } from "lucide-react";
import { useYatraAuth, type UserLogin } from "@/lib/yatra-auth";
import { BASE_URL } from "@/lib/api";
import { TERMS_CLAUSES } from "@/lib/terms";
import { DamPageView } from "@/components/DamPageView";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Login — Krishna Conscious Yatra" },
      { name: "description", content: "Sign in to Krishna Conscious Yatra with your phone number and a one-time password." },
      { property: "og:title", content: "Login — Krishna Conscious Yatra" },
      { property: "og:description", content: "Phone number + OTP login for your Krishna Conscious Yatra dashboard." },
    ],
  }),
  component: AuthPage,
});

type DamPageData = {
  enabled: boolean;
  title: string;
  description: string;
  otp_enabled: boolean;
  accept_payments: boolean;
};

function AuthPage() {
  const navigate = useNavigate();
  const { signIn, user } = useYatraAuth();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [damPage, setDamPage] = useState<DamPageData | null>(null);
  const [damChecked, setDamChecked] = useState(false);
  const [siteSettings, setSiteSettings] = useState<DamPageData | null>(null);
  const [pendingUser, setPendingUser] = useState<UserLogin | null>(null);
  const [showTerms, setShowTerms] = useState(false);

  // bypass hint received from backend on /otp/send
  const [bypassActive, setBypassActive] = useState(false);

  // Fetch site settings (dam page + OTP/payment toggles) before rendering
  useEffect(() => {
    fetch(`${BASE_URL}/dam-page/`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data: DamPageData) => {
        setSiteSettings(data);
        if (data.enabled) setDamPage(data);
      })
      .catch(() => { /* silently ignore — show login on error */ })
      .finally(() => setDamChecked(true));
  }, []);

  useEffect(() => {
    if (user) navigate({ to: "/select-yatra" });
  }, [user, navigate]);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  // ── Step 1: Send OTP ───────────────────────────────────────────────────────

  const sendOtp = async () => {
    if (!/^\d{10}$/.test(phone)) {
      toast.error("Enter a valid 10-digit mobile number");
      return;
    }

    // OTP disabled by admin — use direct login (no OTP needed)
    if (siteSettings?.otp_enabled === false) {
      setSending(true);
      try {
        const res = await fetch(`${BASE_URL}/otp/direct-login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include", // lets the browser store the refresh-token cookie
          body: JSON.stringify({ phone }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.detail ?? "Could not sign in. Please try again.");
          return;
        }
        setPendingUser({
          user_id: data.user_id,
          phone: data.phone,
          access_token: data.access_token,
          expires_in: data.expires_in,
        });
        setShowTerms(true);
      } catch {
        toast.error("Network error. Check your connection and try again.");
      } finally {
        setSending(false);
      }
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`${BASE_URL}/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.detail ?? "Failed to send OTP. Please try again.");
        return;
      }

      setBypassActive(data.bypass_active ?? false);
      setStep("otp");
      setSeconds(30);

      if (data.bypass_active) {
        toast.success("OTP sent!", {
          description: "Bypass mode active — use 123456",
        });
      } else {
        toast.success(`OTP sent to +91 ${phone}`);
      }
    } catch {
      toast.error("Network error. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  // ── Step 2: Verify OTP ─────────────────────────────────────────────────────

  const verify = async (code: string) => {
    if (code.length !== 6) return;

    setVerifying(true);
    try {
      const res = await fetch(`${BASE_URL}/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // lets the browser store the refresh-token cookie
        body: JSON.stringify({ phone, otp: code }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.detail ?? "Invalid OTP. Please try again.");
        setOtp("");
        return;
      }

      // Hold the session, show T&C before signing in
      setPendingUser({
        user_id: data.user_id,
        phone: data.phone,
        access_token: data.access_token,
        expires_in: data.expires_in,
      });
      setShowTerms(true);
    } catch {
      toast.error("Network error. Check your connection and try again.");
      setOtp("");
    } finally {
      setVerifying(false);
    }
  };

  // ── Resend OTP ─────────────────────────────────────────────────────────────

  const resendOtp = async () => {
    setOtp("");
    setSeconds(0);
    await sendOtp();
  };

  const agreeToTerms = () => {
    if (!pendingUser) return;
    signIn(pendingUser);
    toast.success("Welcome to Krishna Conscious Yatra!");
    setShowTerms(false);
    navigate({ to: "/select-yatra" });
  };

  // Show nothing until dam-page status is known (avoids flash of login form)
  if (!damChecked) return null;

  // Dam page is enabled — show maintenance screen instead of login
  if (damPage) return <DamPageView title={damPage.title} description={damPage.description} />;

  return (
    <>
    <main className="mx-auto flex min-h-[calc(100vh-65px)] max-w-md flex-col justify-center px-4 py-8 sm:px-6">
      <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
        <ArrowLeft className="size-4" /> Back to home
      </Link>

      <div className="rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-7">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
          {step === "phone" ? <Phone className="size-6" /> : <ShieldCheck className="size-6" />}
        </span>

        {step === "phone" ? (
          <>
            <h1 className="mt-4 text-center text-2xl font-extrabold tracking-tight">Login to Book Your Yatra</h1>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              We'll send a one-time password to your mobile number.
            </p>

            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Mobile number</Label>
                <div className="flex items-center gap-2">
                  <span className="grid h-12 shrink-0 place-items-center rounded-lg border border-input bg-muted px-3 text-sm font-semibold">
                    +91
                  </span>
                  <Input
                    id="phone"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="98765 43210"
                    className="h-12 min-w-0 text-base"
                    onKeyDown={(e) => e.key === "Enter" && sendOtp()}
                    disabled={sending}
                  />
                </div>
              </div>

              <Button
                onClick={sendOtp}
                size="lg"
                className="w-full bg-gradient-primary font-bold shadow-glow"
                disabled={sending}
              >
                {sending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    {siteSettings?.otp_enabled === false ? "Signing in…" : "Sending…"}
                  </>
                ) : (
                  siteSettings?.otp_enabled === false ? "Continue without OTP" : "Send OTP"
                )}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                By continuing you agree to our Terms &amp; Privacy Policy.
              </p>
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-center text-2xl font-extrabold tracking-tight">Verify your number</h1>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              Enter the 6-digit code sent to <span className="font-semibold text-foreground">+91 {phone}</span>
            </p>

            {/* Bypass hint badge */}
            {bypassActive && (
              <p className="mt-3 rounded-xl bg-amber-50 px-4 py-2 text-center text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                🛠 Dev bypass active — use <span className="font-mono tracking-widest">123456</span>
              </p>
            )}

            <div className="mt-6 flex justify-center">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={(v) => {
                  setOtp(v);
                  if (v.length === 6) verify(v);
                }}
                disabled={verifying}
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} className="size-11 text-base sm:size-12" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button
              onClick={() => verify(otp)}
              size="lg"
              className="mt-6 w-full bg-gradient-primary font-bold shadow-glow"
              disabled={verifying || otp.length !== 6}
            >
              {verifying ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Verifying…
                </>
              ) : (
                "Verify & Continue"
              )}
            </Button>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
              {seconds > 0 ? (
                <span>Resend OTP in {seconds}s</span>
              ) : (
                <button className="font-semibold text-primary" onClick={resendOtp} disabled={sending}>
                  {sending ? "Sending…" : "Resend OTP"}
                </button>
              )}
              <span>·</span>
              <button
                className="font-semibold text-primary"
                onClick={() => {
                  setStep("phone");
                  setOtp("");
                }}
              >
                Change number
              </button>
            </div>
          </>
        )}
      </div>
    </main>

    {/* ── Terms & Conditions Modal ──────────────────────────────────────── */}
    {showTerms && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
        <div className="relative flex max-h-[90dvh] w-full max-w-lg flex-col rounded-3xl border border-border bg-card shadow-2xl">
          {/* Header */}
          <div className="flex shrink-0 items-center gap-3 rounded-t-3xl bg-gradient-primary px-6 py-5 text-primary-foreground">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/20">
              <ScrollText className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-extrabold leading-tight">Terms &amp; Conditions</h2>
              <p className="text-xs font-medium opacity-80">Please read and agree before proceeding</p>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <ul className="space-y-3">
              {TERMS_CLAUSES.map((clause, i) => (
                <li key={i} className="flex gap-3 text-sm leading-relaxed text-foreground">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-gradient-primary text-[10px] font-bold text-primary-foreground shadow-glow">
                    {i + 1}
                  </span>
                  {clause}
                </li>
              ))}
            </ul>
          </div>

          {/* Footer */}
          <div className="shrink-0 rounded-b-3xl border-t border-border bg-muted/40 px-6 py-4">
            <Button
              onClick={agreeToTerms}
              size="lg"
              className="w-full bg-gradient-primary font-bold shadow-glow"
            >
              I Agree &amp; Continue
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              By clicking above you agree to all the terms listed.
            </p>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
