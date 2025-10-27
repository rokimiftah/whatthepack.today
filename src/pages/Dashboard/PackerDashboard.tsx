// src/pages/Dashboard/PackerDashboard.tsx

import { useEffect, useRef, useState } from "react";

import { Badge, Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { IconMicrophone, IconSquare } from "@tabler/icons-react";
import Vapi from "@vapi-ai/web";
import { useQuery } from "convex/react";

import FullscreenLoader from "@shared/components/FullscreenLoader";

import { api } from "../../../convex/_generated/api";

export default function PackerDashboard() {
  const orgResult = useQuery(api.organizations.getForCurrentUser, {});
  const orgId = orgResult?.organization?._id;
  const orders = useQuery(api.orders.list, orgId ? { orgId, status: "paid" as any } : "skip");

  const [isActive, setIsActive] = useState(false);
  const vapiRef = useRef<Vapi | null>(null);

  const pubKey = import.meta.env.PUBLIC_VAPI_PUBLIC_KEY as string | undefined;
  const assistantId = import.meta.env.PUBLIC_VAPI_ASSISTANT_ID as string | undefined;
  const voiceReady = Boolean(pubKey && assistantId);

  useEffect(() => {
    if (pubKey && !vapiRef.current) {
      vapiRef.current = new Vapi(pubKey);
      (vapiRef.current as any).on?.("call-start", () => setIsActive(true));
      (vapiRef.current as any).on?.("call-end", () => setIsActive(false));
    }
    return () => {
      vapiRef.current?.stop();
    };
  }, []);

  const toggleVoice = async () => {
    if (!voiceReady || !orgId) {
      return;
    }

    const v = vapiRef.current!;
    if (isActive) {
      v.stop();
    } else {
      await v.start(assistantId, { metadata: { orgId } } as any);
    }
  };

  if (orgResult === undefined || orders === undefined) {
    return <FullscreenLoader />;
  }

  return (
    <Stack gap="xl">
      <Group justify="space-between" align="center">
        <Stack gap={4}>
          <Title order={3}>Packing queue</Title>
          <Text size="sm" c="gray.6">
            Prioritized list of paid orders ready for the warehouse team.
          </Text>
        </Stack>
        <Button
          variant={isActive ? "light" : "filled"}
          color={isActive ? "red" : "brand"}
          onClick={toggleVoice}
          leftSection={isActive ? <IconSquare size={16} /> : <IconMicrophone size={16} />}
          disabled={!voiceReady}
        >
          {voiceReady ? (isActive ? "Stop voice assistant" : "Start voice assistant") : "Voice assistant unavailable"}
        </Button>
      </Group>

      {!voiceReady && (
        <Paper withBorder radius="lg" p="md" bg="white">
          <Text size="sm" c="gray.6">
            Voice assistant belum aktif. Set environment variable <code>PUBLIC_VAPI_PUBLIC_KEY</code> dan{" "}
            <code>PUBLIC_VAPI_ASSISTANT_ID</code> lalu rebuild frontend.
          </Text>
        </Paper>
      )}

      <Stack gap="md">
        {(orders as any[])?.length === 0 ? (
          <Paper withBorder radius="lg" p="xl" bg="white">
            <Stack gap="xs">
              <Title order={5}>All caught up</Title>
              <Text size="sm" c="gray.6">
                There are no paid orders in the queue. Keep the VAPI assistant running to be notified when new orders arrive.
              </Text>
            </Stack>
          </Paper>
        ) : (
          (orders as any[]).map((order: any) => (
            <Paper key={order._id} withBorder radius="lg" p="lg" shadow="xs" bg="white">
              <Group justify="space-between" align="flex-start">
                <Stack gap={4}>
                  <Title order={4} size="h4">
                    {order.orderNumber || "Manual order"}
                  </Title>
                  <Text size="sm" c="gray.6">
                    {order.recipientName} &middot; {order.recipientCity}
                  </Text>
                </Stack>
                <Badge variant="light" color="brand">
                  {order.status}
                </Badge>
              </Group>
              <Text mt="sm" size="sm" c="gray.7">
                Items:&nbsp;
                {order.items?.map((item: any) => `${item.quantity}× ${item.productName}`).join(", ")}
              </Text>
            </Paper>
          ))
        )}
      </Stack>
    </Stack>
  );
}
