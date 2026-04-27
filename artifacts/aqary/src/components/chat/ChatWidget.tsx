import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, User, Bot, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSendChatMessage } from "@workspace/api-client-react";
import type { ChatHistoryItem, ChatMatchedProperty } from "@workspace/api-client-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";

export function ChatWidget() {
  const { token } = useAuth();

  if (!token) return null;

  return <ChatWidgetInner />;
}

function createSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `chat-${crypto.randomUUID()}`;
  }
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function ChatWidgetInner() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<ChatHistoryItem[]>([
    {
      role: "assistant",
      content: "أهلاً بك! أنا مساعد عقاري يمكنني مساعدتك في العثور على العقار المناسب لك. كيف يمكنني مساعدتك؟",
    },
  ]);
  const [matchedProperties, setMatchedProperties] = useState<ChatMatchedProperty[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef(createSessionId());
  const historyRef = useRef<ChatHistoryItem[]>(history);

  const chatMutation = useSendChatMessage({
    request: {
      headers: {
        "x-chat-session-id": sessionIdRef.current,
      },
    },
  });

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [history, isOpen, matchedProperties]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ar-EG", {
      style: "currency",
      currency: "EGP",
      maximumFractionDigits: 0,
    }).format(price);
  };

  const typeMap: Record<string, string> = {
    apartment: "شقة",
    villa: "فيلا",
    commercial: "تجاري",
    land: "أرض",
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!message.trim() || chatMutation.isPending) return;

    const userMessage = message.trim();
    setMessage("");

    const newHistory: ChatHistoryItem[] = [
      ...historyRef.current,
      { role: "user", content: userMessage },
    ];

    historyRef.current = newHistory;
    setHistory(newHistory);
    setMatchedProperties([]);

    try {
      const response = await chatMutation.mutateAsync({
        data: {
          message: userMessage,
          conversationHistory: newHistory,
        },
      });

      const assistantReply =
        response.reply?.trim() || "عذراً، لم أتمكن من معالجة طلبك الآن.";

      const updatedHistory: ChatHistoryItem[] = [
        ...newHistory,
        { role: "assistant", content: assistantReply },
      ];

      historyRef.current = updatedHistory;
      setHistory(updatedHistory);
      setMatchedProperties(response.properties || []);
    } catch (err) {
      console.error("Chat error:", err);

      const fallbackHistory: ChatHistoryItem[] = [
        ...newHistory,
        {
          role: "assistant",
          content: "عذراً، السيرفر لا يستجيب حالياً. حاول مرة أخرى.",
        },
      ];

      historyRef.current = fallbackHistory;
      setHistory(fallbackHistory);
      setMatchedProperties([]);
    }
  };

  return (
    <>
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50 flex items-center justify-center p-0"
          size="icon"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      )}

      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[350px] h-[500px] max-h-[80vh] bg-card border shadow-xl rounded-2xl flex flex-col z-50 overflow-hidden">
          <div className="bg-primary p-4 flex items-center justify-between text-primary-foreground">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <span className="font-semibold">المساعد الذكي لعقاري</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="text-primary-foreground hover:bg-primary/80 hover:text-white rounded-full h-8 w-8"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-muted/20">
            {history.map((msg, index) => (
              <div
                key={`${msg.role}-${index}-${msg.content.slice(0, 10)}`}
                className={`flex gap-3 max-w-[85%] ${
                  msg.role === "user" ? "mr-auto flex-row-reverse" : "ml-auto"
                }`}
              >
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center ${
                    msg.role === "user"
                      ? "bg-secondary text-secondary-foreground"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {msg.role === "user" ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>

                <div
                  className={`p-3 rounded-2xl text-sm ${
                    msg.role === "user"
                      ? "bg-secondary text-secondary-foreground rounded-tr-sm"
                      : "bg-card border shadow-sm rounded-tl-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {matchedProperties.length > 0 && (
              <div className="ml-auto max-w-[90%]">
                <p className="text-xs mb-2 text-right">عقارات مقترحة:</p>

                <div className="flex flex-col gap-2">
                  {matchedProperties.map((prop) => (
                    <Link
                      key={prop.id}
                      href={`/property/${prop.id}`}
                      onClick={() => setIsOpen(false)}
                    >
                      <div
                        className="bg-card border rounded-lg p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                        data-testid={`chat-property-${prop.id}`}
                      >
                        <p className="font-semibold text-sm line-clamp-1">{prop.title}</p>

                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {prop.location}
                          </span>
                          <span className="text-xs font-bold text-primary">
                            {formatPrice(prop.price)}
                          </span>
                        </div>

                        <span className="text-[10px] text-muted-foreground">
                          {typeMap[prop.propertyType] || prop.propertyType}
                        </span>

                        {prop.matchReasons?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {prop.matchReasons.map((reason, i) => (
                              <span
                                key={i}
                                className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full"
                              >
                                {reason}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {chatMutation.isPending && (
              <div className="flex gap-3 max-w-[85%] ml-auto">
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="p-3 rounded-2xl bg-card border shadow-sm rounded-tl-sm text-sm flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>جاري الكتابة...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 bg-card border-t">
            <form onSubmit={handleSend} className="flex gap-2 relative">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="اكتب رسالتك..."
                disabled={chatMutation.isPending}
                data-testid="input-chat-message"
              />

              <Button
                type="submit"
                size="icon"
                disabled={!message.trim() || chatMutation.isPending}
                className="absolute left-1 top-1 h-8 w-8"
                data-testid="button-send-chat"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}