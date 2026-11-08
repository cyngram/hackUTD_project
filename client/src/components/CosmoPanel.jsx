import { useEffect, useRef, useState } from "react";
import { ArrowRight, Bot, Send, ShieldCheck, X } from "lucide-react";
import { api } from "../lib/api";
import RichText from "./RichText";

// Cosmo: chat that answers using the numbers our engine computed (see server/engine/cosmo.js)
export default function CosmoPanel({ customerId, name, cosmoPrompt, context, onClose }) {
  const [messages, setMessages] = useState([
    {
      from: "cosmo",
      text: `Hi ${name ?? "there"}, I'm Cosmo. I can use your accounts, your car, and your plans to help you think through your next move. What are we planning?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const messagesRef = useRef(null);
  const inputRef = useRef(null);

  // Keep the newest message in view (scroll only the chat, never the page behind it)
  useEffect(() => {
    const box = messagesRef.current;
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const send = async (text) => {
    const clean = text.trim();
    if (!clean || thinking) return;
    const history = messages.slice(1).map((m) => ({ role: m.from === "user" ? "user" : "cosmo", text: m.text }));
    setMessages((items) => [...items, { from: "user", text: clean }]);
    setInput("");
    setThinking(true);
    try {
      const data = await api("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, message: clean, history, assumptions: context?.assumptions ?? {} }),
      });
      setMessages((items) => [...items, { from: "cosmo", text: data.reply }]);
    } catch {
      setMessages((items) => [
        ...items,
        { from: "cosmo", text: "I couldn't reach your numbers just now. Try again in a moment." },
      ]);
    } finally {
      setThinking(false);
    }
  };

  // Opened from the path page with a question ready: ask it right away
  const askedContext = useRef(false);
  useEffect(() => {
    if (context?.prompt && !askedContext.current) {
      askedContext.current = true;
      send(context.prompt);
    }
  }, [context]); // eslint-disable-line react-hooks/exhaustive-deps

  // Suggested questions. "Can I afford…" fills the box so you finish the sentence.
  const suggestions = [
    { label: "What's my best next move?", send: true },
    { label: "How can I improve my credit?", send: true },
    { label: `${(cosmoPrompt ?? "Considering my current state, can I afford ").trim()}…`, fill: cosmoPrompt ?? "Considering my current state, can I afford " },
  ];

  const pick = (s) => {
    if (s.send) return send(s.label);
    setInput(s.fill);
    inputRef.current?.focus();
  };

  return (
    <div className="overlay cosmo-overlay" onMouseDown={onClose}>
      <aside
        className="cosmo-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cosmo-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="cosmo-header">
          <div className="cosmo-title">
            <span className="cosmo-avatar">
              <Bot size={23} />
            </span>
            <div>
              <h2 id="cosmo-title">Cosmo</h2>
              <p>
                <span /> Online · Your financial co-pilot
              </p>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close Cosmo">
            <X size={21} />
          </button>
        </header>
        <div className="data-note">
          <ShieldCheck size={15} /> Answers use your Orbit numbers. Cosmo never makes up figures.
        </div>
        <div className="messages" aria-live="polite" ref={messagesRef}>
          {messages.map((m, i) => (
            <div className={`message ${m.from}`} key={i}>
              {m.from === "cosmo" && (
                <span className="message-avatar">
                  <Bot size={16} />
                </span>
              )}
              <div className="message-body">
                {m.from === "cosmo" ? <RichText text={m.text} /> : <p>{m.text}</p>}
              </div>
            </div>
          ))}
          {thinking && (
            <div className="message cosmo">
              <span className="message-avatar">
                <Bot size={16} />
              </span>
              <div className="message-body typing" aria-label="Cosmo is thinking">
                <span /><span /><span />
              </div>
            </div>
          )}
          {messages.length === 1 && !thinking && (
            <div className="suggested-prompts">
              {suggestions.map((s) => (
                <button key={s.label} onClick={() => pick(s)}>
                  {s.label}
                  <ArrowRight size={14} />
                </button>
              ))}
            </div>
          )}
        </div>
        <form
          className="chat-form"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Cosmo anything…"
            aria-label="Message Cosmo"
          />
          <button type="submit" aria-label="Send message" disabled={thinking}>
            <Send size={18} />
          </button>
        </form>
        <p className="chat-disclaimer">Cosmo provides guidance, not professional financial advice.</p>
      </aside>
    </div>
  );
}
