// src/pages/Privacy/index.tsx

import { Anchor, Box, Button, Container, Divider, Group, List, Paper, Stack, Text, Title } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { useLocation } from "wouter";

export default function PrivacyPolicy() {
  const [, navigate] = useLocation();

  const sections = [
    {
      title: "Introduction",
      content:
        'WhatThePack.today ("we", "our", or "us") respects your privacy and is committed to protecting personal data entrusted to the platform. This policy explains how we collect, use, and safeguard information when you interact with our services.',
    },
    {
      title: "Information We Collect",
      content: "We collect information required to operate your organization workspace effectively, including:",
      list: [
        "Account information: name, email, and Auth0 organization membership.",
        "Operational data: products, orders, stock movements, and shipping metadata you choose to store.",
        "Usage signals: session timestamps, feature adoption, and system events used to improve reliability.",
        "Voice interactions: optional VAPI call transcripts when voice workflows are enabled.",
      ],
    },
    {
      title: "How We Use Your Information",
      content: "We process data solely to deliver and improve WhatThePack.today functionality:",
      list: [
        "Provide real-time dashboards, AI assistance, and notifications.",
        "Authenticate users and enforce role-based permissions.",
        "Detect anomalies, troubleshoot issues, and secure the platform.",
        "Deliver product updates, onboarding support, and compliance notices.",
      ],
    },
    {
      title: "Information Sharing",
      content:
        "We do not sell or rent personal information. Data is shared only with essential subprocessors that power the platform (Auth0, Convex, Resend, VAPI, and optional ShipEngine) under strict data processing agreements, or when legally required.",
    },
    {
      title: "Data Security",
      content:
        "We implement encryption at rest and in transit, enforce least-privilege access, and monitor for suspicious activity. Despite safeguarding measures, no system is infallible—maintain strong credentials and notify us immediately of suspected incidents.",
    },
    {
      title: "User Rights",
      content: "Depending on your jurisdiction, you may have rights to:",
      list: [
        "Access or export your organization’s data.",
        "Request correction of inaccurate records.",
        "Request deletion of specific user profiles (subject to retention obligations).",
        "Limit certain processing in line with applicable law.",
      ],
    },
    {
      title: "Cookies and Tracking",
      content:
        "We use essential cookies and secure local storage to maintain authentication sessions and preferences. We do not run third-party advertising trackers or sell usage analytics.",
    },
    {
      title: "Children’s Privacy",
      content:
        "WhatThePack.today is built for business teams. We do not knowingly collect information from individuals under 16 years old. If you believe a minor has accessed the platform, contact us so we can take appropriate action.",
    },
    {
      title: "International Data Transfers",
      content:
        "Platform data may be processed in the United States and other regions where our infrastructure providers operate. We rely on contractual safeguards and industry-standard security controls for cross-border transfers.",
    },
    {
      title: "Changes to This Policy",
      content:
        "We may update this policy as our services evolve or regulations change. We will post updates here and adjust the “Last updated” date. Material changes may be accompanied by in-app or email notifications.",
    },
    {
      title: "Contact Us",
      content:
        "Have privacy questions or requests? Email privacy@whatthepack.today or use the in-app support channel. We respond to verified requests within a reasonable timeframe.",
    },
  ];

  return (
    <Box bg="gray.0" mih="100vh">
      <Container size="lg" py="xl">
        <Paper shadow="md" radius="xl" p="xl" withBorder bg="white">
          <Stack gap="xl">
            <div>
              <Button variant="subtle" color="gray" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate("/")}>
                Back to home
              </Button>
              <Stack gap={4} mt="lg">
                <Title order={2}>Privacy Policy</Title>
                <Text size="sm" c="gray.6">
                  Last updated:{" "}
                  {new Intl.DateTimeFormat("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  }).format(new Date())}
                </Text>
              </Stack>
            </div>

            <Stack gap="xl">
              {sections.map((section, index) => (
                <Stack key={section.title} gap="sm">
                  <Group gap="sm" align="baseline">
                    <Text fw={600} c="brand.6">
                      {index + 1}.
                    </Text>
                    <Title order={4}>{section.title}</Title>
                  </Group>
                  <Text size="sm" lh={1.7} c="gray.7">
                    {section.content}
                  </Text>
                  {section.list ? (
                    <List spacing="xs" size="sm" c="gray.7">
                      {section.list.map((item) => (
                        <List.Item key={item}>{item}</List.Item>
                      ))}
                    </List>
                  ) : null}
                </Stack>
              ))}
            </Stack>

            <Divider />

            <Stack gap="xs" align="center">
              <Text size="sm" c="gray.6">
                Questions about privacy?{" "}
                <Anchor href="mailto:privacy@whatthepack.today" size="sm">
                  Contact our team
                </Anchor>
              </Text>
              <Text size="xs" c="gray.4">
                © {new Date().getFullYear()} WhatThePack.today. All rights reserved.
              </Text>
            </Stack>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
