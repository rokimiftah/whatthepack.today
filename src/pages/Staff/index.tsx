import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Container,
  Grid,
  Group,
  Loader,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconRefresh, IconTrash, IconUserPlus } from "@tabler/icons-react";
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
    <Container size="lg" py="xl">
      <Stack gap="xl">
        <Stack gap="xs">
          <Text size="xs" tt="uppercase" fw={600} c="gray.6" lts={4}>
            Staff Management
          </Text>
          <Title order={2}>Manage Your Team</Title>
          <Text size="sm" c="gray.6">
            Invite staff members and manage their roles and permissions
          </Text>
        </Stack>

        {/* Staff Performance Metrics */}
        <Card withBorder shadow="sm" radius="lg" bg="white">
          <Stack gap="md">
            <Group justify="space-between">
              <Title order={4}>Staff Performance (7 days)</Title>
              <Badge variant="light" color="brand">
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
                    <Card withBorder radius="md" bg="gray.0">
                      <Stack gap="sm">
                        <Group justify="space-between">
                          <Stack gap={0}>
                            <Text fw={600}>{m.name || m.email || "Unknown"}</Text>
                            <Badge size="xs" variant="light" color={m.role === "admin" ? "blue" : "green"}>
                              {m.role}
                            </Badge>
                          </Stack>
                          <Stack align="end" gap={0}>
                            <Text size="xl" fw={700} c="brand">
                              {m.ordersProcessed}
                            </Text>
                            <Text size="xs" c="gray.6">
                              orders processed
                            </Text>
                          </Stack>
                        </Group>

                        <Grid>
                          <Grid.Col span={4}>
                            <Card bg="white" withBorder radius="sm">
                              <Stack gap={2} align="center">
                                <Text size="xs" c="gray.6">
                                  Avg Time
                                </Text>
                                <Text fw={600}>{m.averageTimePerOrder ? Math.round(m.averageTimePerOrder / 60000) : 0}m</Text>
                              </Stack>
                            </Card>
                          </Grid.Col>
                          <Grid.Col span={4}>
                            <Card bg="white" withBorder radius="sm">
                              <Stack gap={2} align="center">
                                <Text size="xs" c="gray.6">
                                  Total Value
                                </Text>
                                <Text fw={600}>${(m.totalValue || 0).toFixed(2)}</Text>
                              </Stack>
                            </Card>
                          </Grid.Col>
                          <Grid.Col span={4}>
                            <Card bg="white" withBorder radius="sm">
                              <Stack gap={2} align="center">
                                <Text size="xs" c="gray.6">
                                  Efficiency
                                </Text>
                                <Text fw={600}>${(m.efficiency || 0).toFixed(0)}</Text>
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
        <Card withBorder shadow="sm" radius="lg" bg="white">
          <Stack gap="md">
            <Title order={4}>Invite New Staff Member</Title>
            <Text size="sm" c="gray.6">
              Send an invitation email to join your team
            </Text>

            <form onSubmit={handleInvite}>
              <Grid>
                <Grid.Col span={{ base: 12, md: 4 }}>
                  <TextInput
                    label="Email Address"
                    placeholder="staff@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 4 }}>
                  <TextInput
                    label="Full Name"
                    placeholder="e.g. Lisa Setiawan"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
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
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 1 }}>
                  <Button type="submit" fullWidth h={36} mt="xl" leftSection={<IconUserPlus size={16} />}>
                    Invite
                  </Button>
                </Grid.Col>
              </Grid>
            </form>
          </Stack>
        </Card>

        {/* Staff List */}
        <Card withBorder shadow="sm" radius="lg" bg="white">
          <Stack gap="md">
            <Group justify="space-between">
              <Title order={4}>Team Members</Title>
              <ActionIcon variant="light" color="brand" onClick={() => refresh()}>
                <IconRefresh size={16} />
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
              <Table highlightOnHover verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>Email</Table.Th>
                    <Table.Th>Role</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {staff.map((u) => (
                    <Table.Tr key={u._id}>
                      <Table.Td>
                        <Text fw={600}>{u.name || "No name"}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="gray.7">
                          {u.email}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {u.role === "owner" ? (
                          <Badge color="yellow" variant="light">
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
                            size="xs"
                            w={100}
                          />
                        )}
                      </Table.Td>
                      <Table.Td>
                        {u.role !== "owner" && (
                          <ActionIcon color="red" variant="light" onClick={() => handleRemove(u._id)}>
                            <IconTrash size={16} />
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
    </Container>
  );
}
