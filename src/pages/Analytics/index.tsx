import type { KeyboardEvent } from "react";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { IconBulb, IconChartBar, IconRobot, IconSend, IconSparkles } from "@tabler/icons-react";
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
      <Stack gap="xl" align="center" justify="center" style={{ minHeight: "60vh" }}>
        <Loader size="xl" type="dots" color="blue" />
        <Text size="sm" c="dimmed">
          Loading analytics...
        </Text>
      </Stack>
    );
  }

  if (!orgId) {
    return (
      <Stack gap="xl" align="center" justify="center" style={{ minHeight: "60vh" }}>
        <Paper withBorder radius="lg" p="xl" bg="white" shadow="sm">
          <Text size="sm" c="dimmed">
            Organization not found.
          </Text>
        </Paper>
      </Stack>
    );
  }

  return (
    <Stack gap="xl">
      <Paper p="lg" radius="lg" bg="white" style={{ border: "1px solid var(--mantine-color-gray-2)" }}>
        <Group gap="md">
          <ThemeIcon size={48} radius="lg" variant="light" color="blue">
            <IconChartBar size={28} />
          </ThemeIcon>
          <Stack gap={4} style={{ flex: 1 }}>
            <Title order={2} fw={700}>
              AI Business Analyst
            </Title>
            <Text size="sm" c="dimmed">
              Get instant insights and analytics from your business data
            </Text>
          </Stack>
          <Badge variant="light" color="blue" size="lg" radius="lg" leftSection={<IconSparkles size={14} />}>
            AI-Powered
          </Badge>
        </Group>
      </Paper>

      <Card withBorder shadow="sm" radius="lg" bg="white" p="xl">
        <Stack gap="lg">
          <ScrollArea type="auto" h="60vh" viewportRef={chatViewportRef}>
            <Stack gap="lg">
              {messages.map((message) => {
                const isUser = message.role === "user";
                return (
                  <Group key={message.id} justify={isUser ? "flex-end" : "flex-start"} align="flex-start">
                    {!isUser && (
                      <ThemeIcon size="lg" radius="lg" variant="light" color="blue">
                        <IconRobot size={20} />
                      </ThemeIcon>
                    )}
                    <Paper
                      bg={isUser ? "blue.0" : "gray.0"}
                      withBorder
                      radius="lg"
                      shadow="sm"
                      maw="75%"
                      p="lg"
                      style={{
                        border: isUser ? "1px solid var(--mantine-color-blue-2)" : "1px solid var(--mantine-color-gray-2)",
                      }}
                    >
                      <Group gap="xs" align="center" mb="xs">
                        {!isUser && <IconSparkles size={16} color="var(--mantine-color-blue-6)" />}
                        <Text size="xs" fw={700} c={isUser ? "blue.7" : "dimmed"} tt="uppercase">
                          {isUser ? "You" : "AI Analyst"}
                        </Text>
                      </Group>
                      <Text size="sm" lh={1.6} c="gray.8" style={{ whiteSpace: "pre-wrap" }}>
                        {message.content}
                      </Text>
                    </Paper>
                  </Group>
                );
              })}

              {analyzing && (
                <Group justify="flex-start" align="flex-start">
                  <ThemeIcon size="lg" radius="lg" variant="light" color="blue">
                    <IconRobot size={20} />
                  </ThemeIcon>
                  <Paper withBorder radius="lg" shadow="sm" p="lg" maw="60%" bg="gray.0">
                    <Group gap="md" align="center">
                      <Loader size="sm" color="blue" />
                      <Text size="sm" c="dimmed" fw={500}>
                        Analyzing your business data…
                      </Text>
                    </Group>
                  </Paper>
                </Group>
              )}

              {messages.filter((message) => message.role === "user").length === 0 && (
                <Paper
                  withBorder
                  radius="lg"
                  shadow="sm"
                  p="xl"
                  bg="blue.0"
                  style={{ border: "1px solid var(--mantine-color-blue-2)" }}
                >
                  <Stack gap="md">
                    <Group gap="xs">
                      <ThemeIcon size="sm" radius="lg" color="blue" variant="light">
                        <IconBulb size={16} />
                      </ThemeIcon>
                      <Text size="sm" fw={700} c="blue.8">
                        Suggested Questions
                      </Text>
                    </Group>
                    <Stack gap="xs">
                      {suggestions.map((suggestion) => (
                        <Button
                          key={suggestion}
                          variant="light"
                          color="blue"
                          justify="flex-start"
                          fullWidth
                          radius="lg"
                          size="md"
                          leftSection={<IconSparkles size={16} />}
                          onClick={() => handleSuggestionClick(suggestion)}
                          styles={{
                            label: { fontWeight: 500 },
                          }}
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
      </Card>
    </Stack>
  );
}
