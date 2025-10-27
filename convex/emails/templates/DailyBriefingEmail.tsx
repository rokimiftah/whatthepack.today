import type * as React from "react";

import { Body, Container, Head, Html, Section, Text } from "@react-email/components";

export function DailyBriefingEmail(props: {
  orgName: string;
  date: string;
  orderCount: number;
  totalRevenue: number;
  totalProfit: number;
  lowStockItems: string[];
}) {
  const { orgName, date, orderCount, totalRevenue, totalProfit, lowStockItems } = props;
  return (
    <Html>
      <Head />
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Text style={styles.h1}>Daily Briefing</Text>
            <Text style={styles.muted}>
              {orgName} • {date}
            </Text>
          </Section>
          <Section style={styles.content}>
            <Text style={styles.title}>Today's Performance</Text>
            <div style={styles.grid as any}>
              <div style={styles.card}>
                <Text style={styles.cardValue}>{orderCount}</Text>
                <Text style={styles.cardLabel}>Orders</Text>
              </div>
              <div style={styles.card}>
                <Text style={styles.cardValue}>${totalRevenue.toFixed(2)}</Text>
                <Text style={styles.cardLabel}>Revenue</Text>
              </div>
              <div style={styles.card}>
                <Text style={styles.cardValue}>${totalProfit.toFixed(2)}</Text>
                <Text style={styles.cardLabel}>Profit</Text>
              </div>
            </div>
            {lowStockItems.length > 0 && (
              <Section style={styles.alert}>
                <Text style={styles.alertTitle}>Low Stock</Text>
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {lowStockItems.map((i, idx) => (
                    <li key={idx} style={{ color: "#f59e0b" }}>
                      {i}
                    </li>
                  ))}
                </ul>
              </Section>
            )}
            <Text style={{ marginTop: 16 }}>Have a productive day!</Text>
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
  header: { backgroundColor: "#111827", padding: 16, borderRadius: 8 },
  h1: { margin: 0, color: "#fff", fontWeight: 700, fontSize: 18 },
  muted: { margin: 0, color: "#9ca3af", fontSize: 12 },
  content: { backgroundColor: "#161616", padding: 16, borderRadius: 8, marginTop: 8 },
  title: { fontWeight: 600, fontSize: 16, marginBottom: 8 },
  grid: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 },
  card: { backgroundColor: "#0b0b0b", padding: 12, borderRadius: 6, textAlign: "center" },
  cardValue: { fontSize: 18, fontWeight: 700, color: "#fff" },
  cardLabel: { fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#9ca3af" },
  alert: { backgroundColor: "#1f2937", padding: 12, borderRadius: 6, marginTop: 12 },
  alertTitle: { margin: 0, fontWeight: 600, color: "#fbbf24" },
  footer: { textAlign: "center", color: "#9ca3af", fontSize: 12, marginTop: 16 },
};

export default DailyBriefingEmail;
