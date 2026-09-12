import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ArrowLeft, Phone, ShieldCheck } from "lucide-react";
import { useYatraAuth } from "@/lib/yatra-auth";

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

function AuthPage() {
  const navigate = useNavigate();
  const { signIn, user } = useYatraAuth();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (user) navigate({ to: "/select-yatra" });
  }, [user, navigate]);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const sendOtp = () => {
    if (!/^\d{10}$/.test(phone)) {
      toast.error("Enter a valid 10-digit mobile number");
      return;
    }
    setStep("otp");
    setSeconds(30);
    toast.success(`OTP sent to +91 ${phone}`, { description: "Demo OTP: 123456" });
  };

  const verify = (code: string) => {
    if (code.length !== 6) return;
    if (code !== "123456") {
      toast.error("Incorrect OTP. Demo code is 123456");
      setOtp("");
      return;
    }
    signIn({ phone, name: "Traveller" });
    toast.success("Welcome to Krishna Conscious Yatra!");
    navigate({ to: "/select-yatra" });
  };

  return (
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
                  />
                </div>
              </div>

              <Button onClick={sendOtp} size="lg" className="w-full bg-gradient-primary font-bold shadow-glow">
                Send OTP
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                By continuing you agree to our Terms & Privacy Policy.
              </p>
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-center text-2xl font-extrabold tracking-tight">Verify your number</h1>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              Enter the 6-digit code sent to <span className="font-semibold text-foreground">+91 {phone}</span>
            </p>

            <div className="mt-6 flex justify-center">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={(v) => {
                  setOtp(v);
                  if (v.length === 6) verify(v);
                }}
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
            >
              Verify & Continue
            </Button>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
              {seconds > 0 ? (
                <span>Resend OTP in {seconds}s</span>
              ) : (
                <button className="font-semibold text-primary" onClick={() => setSeconds(30)}>
                  Resend OTP
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
  );
}
