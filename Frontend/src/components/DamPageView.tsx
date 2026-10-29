import { Link } from "@tanstack/react-router";
import { Construction } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DamPageView({ title, description }: { title: string; description: string }) {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-65px)] max-w-md flex-col items-center justify-center px-4 py-12 text-center">
      <span className="grid size-16 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
        <Construction className="size-8" />
      </span>
      <h1 className="mt-5 text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      <Button
        asChild
        size="lg"
        className="mt-7 rounded-full bg-gradient-primary px-8 font-bold shadow-glow"
      >
        <Link to="/">Back to Home</Link>
      </Button>
    </main>
  );
}
