import React, { useState, useEffect } from "react";
import { ChatMessage } from "../types";
import { askContractChat } from "../services/gemini";
import { Language, TRANSLATIONS } from "../i18n/translations";
import {
  MessageSquare,
  Send,
  User,
  Shield,
  Briefcase,
  Scale,
  Sparkles,
  Bot,
} from "lucide-react";

interface CounselChatProps {
  contractText: string;
  file?: File;
  lang?: Language;
}

export const CounselChat: React.FC<CounselChatProps> = ({ contractText, file, lang = "en" }) => {
  const t = TRANSLATIONS[lang];

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "init-1",
      sender: "ai",
      persona: "In-House Counsel",
      text: lang === "bn"
        ? "চুক্তি বুদ্ধিমত্তা সক্রিয়। আমি এই চুক্তিটি পরীক্ষা করেছি। আপনি আমাকে দায়বদ্ধতার সীমা, ক্ষতিপূরণ, পেমেন্ট ট্রিগার সম্পর্কে প্রশ্ন করতে পারেন অথবা বিরোধী পক্ষের আইনজীবীকে কোনো ধারা সমর্থন করতে বলতে পারেন।"
        : "Contract intelligence active. I have reviewed this agreement. You can interrogate me on liability caps, non-competes, payment triggers, or ask Opposing Counsel to defend any clause.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [activePersona, setActivePersona] = useState<"In-House Counsel" | "Opposing Counsel" | "Commercial Dealmaker">("In-House Counsel");
  const [input, setInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  // Update initial message when language toggles
  useEffect(() => {
    setMessages((prev) => [
      {
        id: "init-lang-" + Date.now(),
        sender: "ai",
        persona: activePersona,
        text: lang === "bn"
          ? `[ভাষা পরিবর্তন: বাংলা] চুক্তি বুদ্ধিমত্তা সক্রিয়। আপনি আমাকে চুক্তি সম্পর্কে যেকোনো প্রশ্ন করতে পারেন।`
          : `[Language set to English] Contract intelligence active. You may ask me any questions about the agreement.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  }, [lang]);

  const sampleQuestions = lang === "bn" ? [
    "চুক্তির মোট লায়াবিলিটি ক্যাপ কত এবং কোনো ব্যতিক্রম আছে কি?",
    "এই চুক্তি কি ইচ্ছাধীন বাতিল (Termination for Convenience) সমর্থন করে?",
    "ভেন্ডর কি আমাদের ডেটা দিয়ে এআই মডেল প্রশিক্ষণ দিতে পারবে?",
    "মাইলস্টোন বিরোধ কীভাবে নিষ্পত্তি হবে?",
  ] : [
    "What is the total liability cap and are there carve-outs?",
    "Does this contract permit termination for convenience?",
    "Can the vendor use our customer data to train AI models?",
    "How are milestone disputes resolved?",
  ];

  const handleSend = async (questionText?: string) => {
    const q = (questionText || input).trim();
    if (!q || loading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: "user",
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const history = messages.map((m) => ({
        role: m.sender === "user" ? ("user" as const) : ("ai" as const),
        text: m.text,
      }));

      const reply = await askContractChat(contractText, activePersona, history, q, file, lang);

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        persona: activePersona,
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          sender: "ai",
          persona: activePersona,
          text: lang === "bn" ? `বিশ্লেষণে সমস্যা: ${err.message}` : `Error analyzing query: ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface rounded-2xl border border-line p-6 space-y-5">
      {/* Persona Selection Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-line">
        <div>
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <MessageSquare size={17} className="text-brand" /> {t.counselChatTitle}
          </h3>
          <p className="text-xs text-muted mt-0.5">
            {t.counselChatSubtitle}
          </p>
        </div>

        {/* Persona Switcher Buttons */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-solid border border-line">
          <button
            onClick={() => setActivePersona("In-House Counsel")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activePersona === "In-House Counsel"
                ? "bg-brand text-brand-ink"
                : "text-muted hover:text-white"
            }`}
          >
            <Shield size={13} /> {t.personaInHouse}
          </button>
          <button
            onClick={() => setActivePersona("Opposing Counsel")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activePersona === "Opposing Counsel"
                ? "bg-danger text-brand-ink"
                : "text-muted hover:text-white"
            }`}
          >
            <Scale size={13} /> {t.personaOpposing}
          </button>
          <button
            onClick={() => setActivePersona("Commercial Dealmaker")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activePersona === "Commercial Dealmaker"
                ? "bg-brand-2 text-brand-ink"
                : "text-muted hover:text-white"
            }`}
          >
            <Briefcase size={13} /> {t.personaDealmaker}
          </button>
        </div>
      </div>

      {/* Suggested Questions */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-faint flex items-center gap-1">
          <Sparkles size={12} className="text-brand" /> {t.quickQuery}
        </span>
        {sampleQuestions.map((sq, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(sq)}
            className="text-xs px-2.5 py-1 rounded-lg bg-surface-solid border border-line text-muted hover:text-white hover:border-brand transition-all text-left"
          >
            {sq}
          </button>
        ))}
      </div>

      {/* Message Stream */}
      <div className="space-y-3 max-h-[460px] overflow-y-auto p-2 rounded-xl bg-[#060b16] border border-line">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}
          >
            {/* Header info */}
            <div className="flex items-center gap-1.5 text-[11px] text-faint mb-1 px-1">
              {m.sender === "ai" ? (
                <>
                  <Bot size={12} className="text-brand" />
                  <span
                    className={`font-bold ${
                      m.persona === "Opposing Counsel"
                        ? "text-danger"
                        : m.persona === "Commercial Dealmaker"
                        ? "text-brand-2"
                        : "text-brand"
                    }`}
                  >
                    {m.persona === "Opposing Counsel"
                      ? t.personaOpposing
                      : m.persona === "Commercial Dealmaker"
                      ? t.personaDealmaker
                      : t.personaInHouse}
                  </span>
                </>
              ) : (
                <>
                  <User size={12} className="text-muted" />
                  <span>{lang === "bn" ? "আপনি" : "You"}</span>
                </>
              )}
              <span>•</span>
              <span>{m.timestamp}</span>
            </div>

            {/* Bubble */}
            <div
              className={`p-3.5 rounded-2xl max-w-[85%] text-xs leading-relaxed ${
                m.sender === "user"
                  ? "bg-brand/20 text-brand-light border border-brand/30 rounded-tr-sm"
                  : m.persona === "Opposing Counsel"
                  ? "bg-danger/10 text-white/90 border border-danger/30 rounded-tl-sm"
                  : m.persona === "Commercial Dealmaker"
                  ? "bg-brand-2/10 text-white/90 border border-brand-2/30 rounded-tl-sm"
                  : "bg-surface-solid text-white/90 border border-line rounded-tl-sm"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 p-3 text-xs text-brand font-medium">
            <span className="spinner" />
            <span>{t.consulting} {activePersona}...</span>
          </div>
        )}
      </div>

      {/* Input Box */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          placeholder={t.chatPlaceholder}
          className="flex-1 bg-[#060b16] border border-line-strong rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-brand"
        />
        <button
          onClick={() => handleSend()}
          disabled={loading || !input.trim()}
          className="primary px-4 py-3 rounded-xl disabled:opacity-50"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
};


