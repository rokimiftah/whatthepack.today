import type { KeyboardEvent } from "react";

import { useCallback, useEffect, useRef, useState } from "react";

import { ActionIcon, Badge, Button, Center, Group, Loader, Paper, ScrollArea, Stack, Text, Textarea, Title } from "@mantine/core";
import { IconSend, IconSparkles } from "@tabler/icons-react";
import { useAction, useQuery } from "convex/react";

import { toast } from "@shared/components/Toast";

import { api } from "../../../convex/_generated/api";

// src/pages/Analytics/index.tsx

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

const suggestions = [
  "Show me sales trends for the last 30 days",
  "Which products are most profitable?",
  "Analyze my inventory health",
  "What are my top customers?",
  "Compare this week's performance vs last week",
];

export default function AnalyticsPage() {
  const orgResult = useQuery(api.organizations.getForCurrentUser, {});
  const orgId = orgResult?.organization?._id;

  const generateDailyBriefing = useAction((api as any)["agents/briefingAgent"].generateDailyBriefing);
  const analyzeBusinessData = useAction((api as any)["agents/analystAgent"].analyzeBusinessData);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const chatViewportRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = useCallback(() => {
    if (chatViewportRef.current) {
      chatViewportRef.current.scrollTop = chatViewportRef.current.scrollHeight;
    }
  }, []);

  const messageCount = messages.length;

  // biome-ignore lint/correctness/useExhaustiveDependencies: run scroll when message count changes
  useEffect(() => {
    scrollToBottom();
  }, [messageCount, scrollToBottom]);

  useEffect(() => {
    if (analyzing) {
      scrollToBottom();
    }
  }, [analyzing, scrollToBottom]);

  useEffect(() => {
    const loadBriefing = async () => {
      if (!orgId || messages.length > 0) return;
      try {
        const result = await generateDailyBriefing({ orgId });
        const briefingMessage: Message = {
          id: "briefing-0",
          role: "assistant",
          content: result.briefing,
          timestamp: Date.now(),
        };
        setMessages([briefingMessage]);
      } catch (error) {
        console.error("Failed to load briefing:", error);
      }
    };
    loadBriefing();
  }, [orgId, messages.length, generateDailyBriefing]);

  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || !orgId) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setAnalyzing(true);

    try {
      const result = await analyzeBusinessData({
        query: userMessage.content,
        orgId,
      });

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: result.analysis,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error("Analysis error:", error);
      toast.error("Failed to analyze. Please try again.");

      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "I'm sorry, I encountered an error while analyzing your question. Please try again or rephrase your question.",
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setAnalyzing(false);
    }
  }, [input, orgId, analyzeBusinessData]);

  const handleKeyPress = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
  };

  if (orgResult === undefined) {
    return (
      <Center h="100vh">
        <Loader size="xl" type="dots" />
      </Center>
    );
  }

  if (!orgId) {
    return (
      <Center h="100vh">
        <Paper withBorder radius="lg" p="xl" bg="white">
          <Text size="sm" c="gray.6">
            Organization not found.
          </Text>
        </Paper>
      </Center>
    );
  }

  return (
    <Paper withBorder radius="xl" bg="white" p="lg">
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <Stack gap={4}>
            <Text size="xs" tt="uppercase" fw={600} c="gray.6" lts={4}>
              Analytics
            </Text>
            <Group gap="sm">
              <IconSparkles size={18} color="#5f84f0" />
              <Title order={3}>Business analyst AI</Title>
            </Group>
          </Stack>
          <Badge variant="light" color="brand">
            Secure insights
          </Badge>
        </Group>

        <ScrollArea type="auto" h="60vh" viewportRef={chatViewportRef}>
          <Stack gap="md">
            {messages.map((message) => {
              const isUser = message.role === "user";
              return (
                <Group key={message.id} justify={isUser ? "flex-end" : "flex-start"}>
                  <Paper bg={isUser ? "brand.0" : "white"} withBorder radius="lg" shadow="xs" maw="75%" p="md">
                    <Group gap="xs" align="center">
                      {!isUser && <IconSparkles size={16} color="#5f84f0" />}
                      <Text size="xs" fw={600} c="gray.6" tt="uppercase" lts={2}>
                        {isUser ? "You" : "AI analyst"}
                      </Text>
                    </Group>
                    <Text mt={6} size="sm" lh={1.6} c="gray.8" style={{ whiteSpace: "pre-wrap" }}>
                      {message.content}
                    </Text>
                  </Paper>
                </Group>
              );
            })}

            {analyzing && (
              <Group justify="flex-start">
                <Paper withBorder radius="lg" shadow="xs" p="md" maw="60%" bg="white">
                  <Group gap="sm" align="center">
                    <Loader size="sm" />
                    <Text size="sm" c="gray.6">
                      Analyzing your business data…
                    </Text>
                  </Group>
                </Paper>
              </Group>
            )}

            {messages.filter((message) => message.role === "user").length === 0 && (
              <Paper withBorder radius="lg" shadow="xs" p="lg" bg="white">
                <Stack gap="sm">
                  <Text size="sm" fw={600} c="gray.7">
                    Try asking:
                  </Text>
                  <Stack gap="xs">
                    {suggestions.map((suggestion) => (
                      <Button
                        key={suggestion}
                        variant="subtle"
                        justify="space-between"
                        onClick={() => handleSuggestionClick(suggestion)}
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </Stack>
                </Stack>
              </Paper>
            )}
          </Stack>
        </ScrollArea>

        <Paper withBorder radius="lg" shadow="md" p="lg" bg="white">
          <Stack gap="sm">
            <Textarea
              value={input}
              onChange={(event) => setInput(event.currentTarget.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask me about your business… e.g. “Show me sales trends”"
              minRows={3}
              radius="md"
            />
            <Group justify="space-between" align="center">
              <Text size="xs" c="gray.5">
                Press Enter to send, Shift + Enter for a new line
              </Text>
              <ActionIcon
                size="lg"
                variant="filled"
                color="brand"
                onClick={handleSendMessage}
                disabled={analyzing || !input.trim()}
              >
                {analyzing ? <Loader size="sm" color="white" /> : <IconSend size={18} />}
              </ActionIcon>
            </Group>
          </Stack>
        </Paper>
      </Stack>
    </Paper>
  );
}
