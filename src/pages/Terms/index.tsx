// src/pages/Terms/index.tsx

import { Anchor, Box, Button, Container, Divider, Group, List, Paper, Stack, Text, Title } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { useLocation } from "wouter";

export default function TermsOfService() {
  const [, navigate] = useLocation();

  const sections = [
    {
      title: "Acceptance of Terms",
      content:
        "By accessing and using WhatThePack.today, you agree to be bound by these terms and confirm that you are authorized to act on behalf of your organization.",
    },
    {
      title: "Purpose and Disclaimer",
      content:
        "WhatThePack.today provides operational tooling and AI assistance for D2C teams. The platform delivers workflow guidance, notifications, and insights based on the data your organization maintains within our systems.",
      extra: (
        <Text size="sm">
          <Text component="span" fw={600}>
            Important:
          </Text>{" "}
          Your team remains responsible for validating operational outcomes, shipping decisions, and compliance with regional
          regulations.
        </Text>
      ),
    },
    {
      title: "User Content",
      content: "You are responsible for all content submitted to WhatThePack.today. By submitting content, you confirm that:",
      list: [
        "It is accurate to the best of your knowledge and sourced from your own operations.",
        "You have the right to share the information within your organization.",
        "It does not contain unauthorized personal data or sensitive financial credentials.",
        "It respects all applicable privacy, data protection, and export control regulations.",
      ],
    },
    {
      title: "Operational Guidance",
      content:
        "AI-generated recommendations and workflow automation are provided for efficiency. They do not replace human review. You should always verify high-impact decisions, such as shipment releases, refunds, and compliance checks.",
    },
    {
      title: "No Liability",
      content:
        "WhatThePack.today and its operators are not liable for any operational outcomes, shipment issues, or financial loss arising from decisions taken using the platform. Always confirm critical steps with your team’s standard operating procedures.",
    },
    {
      title: "Respect for All Stakeholders",
      content:
        "When collaborating through the platform, treat teammates, vendors, and partners with respect. Do not use WhatThePack.today to engage in harassment, discrimination, or the distribution of fraudulent content.",
    },
    {
      title: "Content Moderation",
      content: "We may remove content or restrict access that violates these terms, including content that:",
      list: [
        "Compromises platform security or attempts to evade access controls.",
        "Contains phishing, malware, or unauthorized credential sharing.",
        "Breaches privacy obligations or applicable laws.",
        "Harasses teammates, vendors, or courier partners.",
      ],
    },
    {
      title: "Changes to Terms",
      content:
        "We may update these terms to reflect product improvements or regulatory requirements. Continued use of the platform after changes indicates acceptance of the revised terms.",
    },
    {
      title: "Contact",
      content:
        "For questions about these Terms of Service, contact our support team at support@whatthepack.today. We aim to respond within two business days.",
    },
  ];

  return (
    <Box bg="gray.0" mih="100vh">
      <Container size="lg" py="xl">
        <Paper shadow="md" radius="xl" p="xl" withBorder bg="white">
          <Stack gap="xl">
            <div>
              <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate("/")} color="gray">
                Back to home
              </Button>
              <Stack gap={4} mt="lg">
                <Title order={2}>Terms of Service</Title>
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
                  {section.extra}
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
                Need clarification?{" "}
                <Anchor href="mailto:support@whatthepack.today" size="sm">
                  Contact support
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
