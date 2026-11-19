import React, { useEffect, useState } from "react";
import { Hourglass } from "lucide-react";
import { GeminiStatus, onGeminiStatus } from "../services/gemini";
import { useLang } from "../i18n/lang";

/** Small floating notice while a Gemini request waits for an overloaded model or a rate limit. */
export function GeminiStatusPill() {
  const { L, num } = useLang();
  const [status, setStatus] = useState<GeminiStatus>({ state: "ok" });
  const [left, setLeft] = useState(0);

  useEffect(() => onGeminiStatus((s) => {
    setStatus(s);
    if (s.state === "waiting") setLeft(s.seconds);
  }), []);
  useEffect(() => {
    if (status.state !== "waiting") return;
    const t = setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(t);
  }, [status]);

  if (status.state !== "waiting") return null;
  return (
    <div className="aiWait" role="status" aria-live="polite">
      <Hourglass size={15} />
      <span>
        {status.reason === "limit"
          ? L(`Rate limit reached. Waiting ${left}s, then trying again…`, `ব্যবহারের সীমায় পৌঁছেছে। ${num(left)} সেকেন্ড অপেক্ষা করে আবার চেষ্টা করছি…`)
          : L(`The AI model is busy. Trying again in ${left}s…`, `এআই মডেল এখন ব্যস্ত। ${num(left)} সেকেন্ড পরে আবার চেষ্টা করছি…`)}
      </span>
    </div>
  );
}
