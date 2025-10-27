import type * as React from "react";

import { Body, Container, Head, Hr, Html, Link, Section, Text } from "@react-email/components";

export function StockAlertEmail(props: {
  orgName: string;
  orgSlug: string;
  productSku: string;
  productName: string;
  currentStock: number;
  reportedBy: string;
  timestamp: number;
}) {
  const { orgName, orgSlug, productSku, productName, currentStock, reportedBy, timestamp } = props;
  return (
    <Html>
      <Head />
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Text style={styles.h1}>CRITICAL STOCK ALERT</Text>
            <Text style={styles.muted}>{orgName}</Text>
          </Section>
          <Section style={styles.content}>
            <Text style={styles.title}>
              {productName} ({productSku}) is low
            </Text>
            <Text>
              <strong>Current Stock:</strong> {currentStock}
            </Text>
            <Text>
              <strong>Reported By:</strong> {reportedBy}
            </Text>
            <Text>
              <strong>Time:</strong> {new Date(timestamp).toLocaleString()}
            </Text>
            <Hr style={{ borderColor: "#eee", margin: "16px 0" }} />
            <Text>Recommended action: Contact your vendor to reorder this product.</Text>
            <Link href={`https://${orgSlug}.whatthepack.today/inventory`} style={styles.button}>
              View Inventory
            </Link>
          </Section>
          <Text style={styles.footer}>This is an automated notification from WhatThePack.today</Text>
        </Container>
      </Body>
    </Html>
  );
}

const styles: Record<string, React.CSSProperties> = {
  body: { backgroundColor: "#0b0b0b", color: "#e5e7eb" },
  container: { maxWidth: 600, margin: "0 auto", padding: 20 },
  header: { backgroundColor: "#7f1d1d", padding: 16, borderRadius: 8 },
  h1: { margin: 0, color: "#fff", fontWeight: 700, fontSize: 18 },
  muted: { margin: 0, color: "#fca5a5", fontSize: 12 },
  content: { backgroundColor: "#161616", padding: 16, borderRadius: 8, marginTop: 8 },
  title: { fontWeight: 600, fontSize: 16, marginBottom: 8 },
  button: {
    display: "inline-block",
    marginTop: 12,
    backgroundColor: "#e5e7eb",
    color: "#111827",
    textDecoration: "none",
    padding: "10px 16px",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
  },
  footer: { textAlign: "center", color: "#9ca3af", fontSize: 12, marginTop: 16 },
};

export default StockAlertEmail;
