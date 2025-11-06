import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Grid,
  Group,
  Loader,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconChartBar,
  IconClock,
  IconMail,
  IconPackage,
  IconRefresh,
  IconShield,
  IconTrash,
  IconTrendingUp,
  IconUser,
  IconUserPlus,
  IconUsers,
} from "@tabler/icons-react";
import { useAction, useQuery } from "convex/react";

import FullscreenLoader from "@shared/components/FullscreenLoader";

import { api } from "../../../convex/_generated/api";

type Staff = { _id: string; name?: string; email?: string; role?: "admin" | "packer" | "owner" };

export default function StaffManagementPage() {
  const org = useQuery(api.organizations.getForCurrentUser, {});
  const orgId = org?.organization?._id;
  const sevenDays = useMemo(() => {
    const end = Date.now();
    const start = end - 7 * 24 * 60 * 60 * 1000;
    return { start, end };
  }, []);
  const staffMetrics = useQuery(
    api.analytics.getStaffAnalytics,
    orgId ? { orgId, dateRange: { startDate: sevenDays.start, endDate: sevenDays.end } } : "skip",
  );

  const listStaff = useAction(api.mgmt.listStaff);
  const inviteStaff = useAction(api.mgmt.inviteStaff);
  const updateStaffRole = useAction(api.mgmt.updateStaffRole);
  const removeStaff = useAction(api.mgmt.removeStaff);

  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "packer">("admin");

  const refresh = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const users: any = await listStaff({ orgId });
      setStaff(users || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [orgId, listStaff]);

  useEffect(() => {
    if (orgId) void refresh();
  }, [orgId, refresh]);

  if (org === undefined) {
    return <FullscreenLoader />;
  }

  if (!orgId) {
    return <div className="p-6 text-sm text-neutral-400">Organization not found.</div>;
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !name.trim()) return;
    try {
      await inviteStaff({ orgId, email: email.trim(), name: name.trim(), role });
      setEmail("");
      setName("");
      alert("Invitation sent");
      void refresh();
    } catch (err: any) {
      alert(err?.message || "Failed to invite");
    }
  };

  const handleRoleChange = async (userId: string, newRole: "admin" | "packer") => {
    try {
      await updateStaffRole({ orgId, userId: userId as any, newRole });
      void refresh();
    } catch (e: any) {
      alert(e?.message || "Failed to update role");
    }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm("Remove this staff member?")) return;
    try {
      await removeStaff({ orgId, userId: userId as any });
      void refresh();
    } catch (e: any) {
      alert(e?.message || "Failed to remove");
    }
  };

  return (
    <Stack gap="xl">
      <Paper p="lg" radius="lg" bg="white" style={{ border: "1px solid var(--mantine-color-gray-2)" }}>
        <Group gap="md">
          <ThemeIcon size={48} radius="lg" variant="light" color="blue">
            <IconUsers size={28} />
          </ThemeIcon>
          <Stack gap={4}>
            <Title order={2} fw={700}>
              Staff Management
            </Title>
            <Text size="sm" c="dimmed">
              Invite staff members and manage their roles and permissions
            </Text>
          </Stack>
        </Group>
      </Paper>

      {/* Staff Performance Metrics */}
      <Card withBorder shadow="sm" radius="lg" bg="white">
        <Stack gap="md">
          <Group justify="space-between">
            <Group gap="sm">
              <ThemeIcon size="lg" radius="lg" variant="light" color="teal">
                <IconChartBar size={20} />
              </ThemeIcon>
              <div>
                <Title order={3} fw={700}>
                  Staff Performance
                </Title>
                <Text size="xs" c="dimmed">
                  Last 7 days
                </Text>
              </div>
            </Group>
            <Badge variant="light" color="green" size="lg" radius="lg">
              Live metrics
            </Badge>
          </Group>

          {staffMetrics === undefined ? (
            <Stack align="center" py="xl">
              <Loader size="xl" type="dots" />
              <Text size="sm" c="gray.6">
                Loading performance metrics...
              </Text>
            </Stack>
          ) : staffMetrics?.staff?.length ? (
            <Grid>
              {staffMetrics.staff.map((m: any) => (
                <Grid.Col key={m.userId} span={{ base: 12, sm: 6 }}>
                  <Card withBorder radius="lg" bg="gray.0" p="lg">
                    <Stack gap="md">
                      <Group justify="space-between">
                        <Group gap="sm">
                          <ThemeIcon size="lg" radius="lg" variant="light" color={m.role === "admin" ? "blue" : "green"}>
                            {m.role === "admin" ? <IconShield size={20} /> : <IconPackage size={20} />}
                          </ThemeIcon>
                          <Stack gap={2}>
                            <Text fw={700} size="sm">
                              {m.name || m.email || "Unknown"}
                            </Text>
                            <Badge size="sm" variant="light" color={m.role === "admin" ? "blue" : "green"} radius="lg">
                              {m.role}
                            </Badge>
                          </Stack>
                        </Group>
                        <Stack align="end" gap={2}>
                          <Text size="2rem" fw={900} c="blue" style={{ lineHeight: 1 }}>
                            {m.ordersProcessed}
                          </Text>
                          <Text size="xs" c="dimmed" fw={500}>
                            orders processed
                          </Text>
                        </Stack>
                      </Group>

                      <Grid>
                        <Grid.Col span={4}>
                          <Card bg="white" withBorder radius="lg" p="sm">
                            <Stack gap={4} align="center">
                              <ThemeIcon size="sm" radius="lg" variant="light" color="cyan">
                                <IconClock size={12} />
                              </ThemeIcon>
                              <Text size="xs" c="dimmed" fw={500}>
                                Avg Time
                              </Text>
                              <Text fw={700} size="lg">
                                {m.averageTimePerOrder ? Math.round(m.averageTimePerOrder / 60000) : 0}m
                              </Text>
                            </Stack>
                          </Card>
                        </Grid.Col>
                        <Grid.Col span={4}>
                          <Card bg="white" withBorder radius="lg" p="sm">
                            <Stack gap={4} align="center">
                              <ThemeIcon size="sm" radius="lg" variant="light" color="teal">
                                <IconTrendingUp size={12} />
                              </ThemeIcon>
                              <Text size="xs" c="dimmed" fw={500}>
                                Total Value
                              </Text>
                              <Text fw={700} size="lg">
                                ${(m.totalValue || 0).toFixed(0)}
                              </Text>
                            </Stack>
                          </Card>
                        </Grid.Col>
                        <Grid.Col span={4}>
                          <Card bg="white" withBorder radius="lg" p="sm">
                            <Stack gap={4} align="center">
                              <ThemeIcon size="sm" radius="lg" variant="light" color="violet">
                                <IconChartBar size={12} />
                              </ThemeIcon>
                              <Text size="xs" c="dimmed" fw={500}>
                                Efficiency
                              </Text>
                              <Text fw={700} size="lg">
                                ${(m.efficiency || 0).toFixed(0)}
                              </Text>
                            </Stack>
                          </Card>
                        </Grid.Col>
                      </Grid>
                    </Stack>
                  </Card>
                </Grid.Col>
              ))}
            </Grid>
          ) : (
            <Paper withBorder radius="md" p="lg" bg="gray.0">
              <Text size="sm" c="gray.6" ta="center">
                No staff activity in the last 7 days.
              </Text>
            </Paper>
          )}
        </Stack>
      </Card>

      {/* Invite New Staff */}
      <Card withBorder shadow="sm" radius="lg" bg="white" p="lg">
        <Stack gap="md">
          <Group gap="sm">
            <ThemeIcon size="lg" radius="lg" variant="light" color="indigo">
              <IconUserPlus size={20} />
            </ThemeIcon>
            <div>
              <Title order={3} fw={700}>
                Invite New Staff Member
              </Title>
              <Text size="sm" c="dimmed">
                Send an invitation email to join your team
              </Text>
            </div>
          </Group>

          <form onSubmit={handleInvite}>
            <Grid>
              <Grid.Col span={{ base: 12, md: 3 }}>
                <TextInput
                  label="Full Name"
                  placeholder="e.g. Lisa Setiawan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  radius="lg"
                  size="md"
                  leftSection={<IconUser size={16} />}
                  title=""
                  styles={{
                    input: { fontWeight: 500 },
                  }}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 3 }}>
                <TextInput
                  label="Email Address"
                  placeholder="staff@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  radius="lg"
                  size="md"
                  leftSection={<IconMail size={16} />}
                  title=""
                  styles={{
                    input: { fontWeight: 500 },
                  }}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 3 }}>
                <Select
                  label="Role"
                  data={[
                    { value: "admin", label: "Admin" },
                    { value: "packer", label: "Packer" },
                  ]}
                  value={role}
                  onChange={(value) => setRole(value as "admin" | "packer")}
                  required
                  radius="lg"
                  size="md"
                  leftSection={<IconShield size={16} />}
                  title=""
                  styles={{
                    input: { fontWeight: 500 },
                  }}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 3 }}>
                <Button
                  type="submit"
                  fullWidth
                  leftSection={<IconUserPlus size={16} />}
                  radius="lg"
                  size="md"
                  style={{ marginTop: 31 }}
                >
                  Invite
                </Button>
              </Grid.Col>
            </Grid>
          </form>
        </Stack>
      </Card>

      {/* Staff List */}
      <Card withBorder shadow="sm" radius="lg" bg="white" style={{ overflow: "hidden" }}>
        <Stack gap="md" p="lg">
          <Group justify="space-between">
            <Group gap="sm">
              <ThemeIcon size="lg" radius="lg" variant="light" color="grape">
                <IconUsers size={20} />
              </ThemeIcon>
              <Title order={3} fw={700}>
                Team Members
              </Title>
            </Group>
            <ActionIcon variant="light" color="blue" size="lg" radius="lg" onClick={() => refresh()}>
              <IconRefresh size={18} />
            </ActionIcon>
          </Group>

          {loading ? (
            <Stack align="center" py="xl">
              <Loader size="xl" type="dots" />
              <Text size="sm" c="gray.6">
                Loading team members...
              </Text>
            </Stack>
          ) : staff.length === 0 ? (
            <Paper withBorder radius="md" p="lg" bg="gray.0">
              <Text size="sm" c="gray.6" ta="center">
                No staff members yet. Invite your first team member above.
              </Text>
            </Paper>
          ) : (
            <Table highlightOnHover verticalSpacing="md" horizontalSpacing="lg">
              <Table.Thead style={{ backgroundColor: "var(--mantine-color-gray-0)" }}>
                <Table.Tr>
                  <Table.Th>
                    <Text fw={600} size="sm">
                      Name
                    </Text>
                  </Table.Th>
                  <Table.Th>
                    <Text fw={600} size="sm">
                      Email
                    </Text>
                  </Table.Th>
                  <Table.Th>
                    <Text fw={600} size="sm">
                      Role
                    </Text>
                  </Table.Th>
                  <Table.Th>
                    <Text fw={600} size="sm">
                      Actions
                    </Text>
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {staff.map((u) => (
                  <Table.Tr key={u._id}>
                    <Table.Td>
                      <Group gap="sm">
                        <ThemeIcon
                          size="md"
                          radius="lg"
                          variant="light"
                          color={u.role === "owner" ? "yellow" : u.role === "admin" ? "blue" : "green"}
                        >
                          <IconUser size={16} />
                        </ThemeIcon>
                        <Text fw={600} size="sm">
                          {u.name || "No name"}
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {u.email}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {u.role === "owner" ? (
                        <Badge color="yellow" variant="light" size="lg" radius="lg">
                          Owner
                        </Badge>
                      ) : (
                        <Select
                          data={[
                            { value: "admin", label: "Admin" },
                            { value: "packer", label: "Packer" },
                          ]}
                          value={u.role}
                          onChange={(value) => handleRoleChange(u._id, value as "admin" | "packer")}
                          size="sm"
                          w={120}
                          radius="lg"
                          styles={{
                            input: { fontWeight: 500 },
                          }}
                        />
                      )}
                    </Table.Td>
                    <Table.Td>
                      {u.role !== "owner" && (
                        <ActionIcon color="red" variant="light" size="lg" radius="lg" onClick={() => handleRemove(u._id)}>
                          <IconTrash size={18} />
                        </ActionIcon>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
