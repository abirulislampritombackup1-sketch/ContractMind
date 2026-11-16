import { useEffect, useState } from "react";

export default function Thinking({ messages, compact, big }: { messages: string[]; compact?: boolean; big?: boolean }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI(x => (x + 1) % messages.length), 2400);
    return () => clearInterval(t);
  }, [messages.length]);
  return (
    <div className={"thinking" + (compact ? " compact" : "")}>
      <span className="orb" />
      <div className="tbody">
        <b key={i} className="tmsg">{messages[i]}{compact && <span className="dots"><i /><i /><i /></span>}</b>
        {!compact && <div className="skel">{Array.from({ length: big ? 5 : 3 }).map((_, k) => <i key={k} />)}</div>}
      </div>
    </div>
  );
}
