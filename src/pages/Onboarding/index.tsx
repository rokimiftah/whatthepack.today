import type { Id } from "../../../convex/_generated/dataModel";
import type { ReactNode } from "react";

import { useEffect, useMemo, useState } from "react";

import { useAuth0 } from "@auth0/auth0-react";
import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Center,
  Code,
  Container,
  Divider,
  Group,
  List,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  useMantineTheme,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconAlertCircle, IconMail } from "@tabler/icons-react";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { useLocation } from "wouter";

import { buildOrgUrl, getCurrentSubdomain, isReservedSubdomain } from "@shared/utils/subdomain";

import { api } from "../../../convex/_generated/api";

const slugRegex = /^[a-z0-9-]+$/;
const MAX_SLUG_LENGTH = 48;

const instructions = [
  "Set your business name. This shows up on dashboards and emails.",
  "Pick a secure subdomain for your staff. This becomes store-name.whatthepack.today.",
  "Finish setup to jump into your owner dashboard.",
];

type ClientOrg = {
  _id: Id<"organizations">;
  slug: string;
  name?: string;
  onboardingCompleted?: boolean;
};

type OrgQueryResult =
  | {
      organization: ClientOrg | null;
      roles: string[];
      isOwner: boolean;
    }
  | null
  | undefined;

type SlugAvailabilityReason = "available" | "current" | "taken" | "invalid_format" | "reserved" | undefined;

export default function OnboardingPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { loginWithRedirect, user, logout } = useAuth0();
  const [, navigate] = useLocation();
  const subdomain = getCurrentSubdomain();
  const platformHost = typeof window !== "undefined" ? window.location.hostname : null;
  const isPlatformDomain = !subdomain && platformHost !== null;

  const isEmailVerified = user?.email_verified ?? false;
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendStatus, setResendStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("verified") === "true") {
      window.history.replaceState({}, "", "/onboarding");
    }
  }, []);

  const scopedOrgArgs = useMemo(() => (subdomain ? { expectedSlug: subdomain } : {}), [subdomain]);
  const fallbackOrgArgs = useMemo(() => ({}) as { expectedSlug?: string }, []);

  const organizationResult = useQuery(api.organizations.getForCurrentUser, isAuthenticated ? scopedOrgArgs : "skip");
  const organizationFallbackResult = useQuery(
    api.organizations.getForCurrentUser,
    isAuthenticated && subdomain ? fallbackOrgArgs : "skip",
  );

  const orgResult = organizationResult as OrgQueryResult;
  const fallbackResult = organizationFallbackResult as OrgQueryResult;
  const sessionMetadata = useQuery(api.auth.getSessionMetadata, isAuthenticated ? {} : "skip");

  const org = orgResult?.organization ?? null;
  const actualOrg =
    subdomain && fallbackResult && fallbackResult.organization !== undefined ? (fallbackResult.organization ?? null) : org;
  const actualOrgSlug = actualOrg?.slug ?? null;
  const fallbackIsOwner =
    subdomain && fallbackResult && fallbackResult.isOwner !== undefined ? (fallbackResult.isOwner ?? false) : false;

  const subdomainMismatch =
    Boolean(isAuthenticated && subdomain && actualOrgSlug && actualOrgSlug !== subdomain && orgResult === null) || false;
  const checkingSubdomainMismatch = isAuthenticated && subdomain && orgResult === null && fallbackResult === undefined;
  const isOwner = orgResult?.isOwner ?? fallbackIsOwner;

  const noOrg = !org && !actualOrg;

  const [initialized, setInitialized] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [slugValue, setSlugValue] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const normalizedSlug = useMemo(() => sanitizeSlug(slugValue), [slugValue]);
  const slugIsReserved = useMemo(() => (normalizedSlug ? isReservedSubdomain(normalizedSlug) : false), [normalizedSlug]);
  const slugChanged = useMemo(() => {
    if (!org) return true;
    return normalizedSlug !== org.slug;
  }, [normalizedSlug, org]);

  const shouldCheckSlug = useMemo(() => {
    if (!normalizedSlug) return false;
    if (!slugRegex.test(normalizedSlug)) return false;
    if (slugIsReserved) return false;
    if (org && normalizedSlug === org.slug) return false;
    return true;
  }, [normalizedSlug, org, slugIsReserved]);

  const slugAvailability = useQuery(
    api.organizations.checkSlugAvailability,
    isAuthenticated && shouldCheckSlug ? { slug: normalizedSlug } : "skip",
  );

  const slugCheckLoading = shouldCheckSlug && slugAvailability === undefined;
  const remoteUnavailable =
    shouldCheckSlug && slugAvailability !== undefined && slugAvailability !== null && !slugAvailability.available;
  const slugUnavailable = slugIsReserved || remoteUnavailable;
  const slugAvailabilityReason = slugIsReserved ? "reserved" : slugAvailability?.reason;

  const setSlugMutation = useMutation(api.organizations.setSlug);
  const updateOrgMutation = useMutation(api.organizations.update);
  const completeOnboardingAction = useAction(api.onboarding.completeOnboarding);
  const resendVerificationEmail = useAction(api.mgmt.resendVerificationEmail);

  const theme = useMantineTheme();
  const isLargeScreen = useMediaQuery(`(min-width: ${theme.breakpoints.lg})`);

  useEffect(() => {
    if (org && !initialized) {
      setBusinessName(org.name ?? "");
      setSlugValue(org.slug);
      setInitialized(true);
      return;
    }

    if (noOrg && !initialized && user?.email) {
      const defaultName = user.email.split("@")[0];
      setBusinessName(defaultName);
      setSlugValue(sanitizeSlug(defaultName));
      setInitialized(true);
    }
  }, [org, noOrg, initialized, user]);

  useEffect(() => {
    if (!subdomainMismatch || !actualOrgSlug || typeof window === "undefined") {
      return;
    }

    const targetPath = window.location.pathname.startsWith("/dashboard")
      ? "/dashboard"
      : window.location.pathname.startsWith("/onboarding")
        ? "/onboarding"
        : window.location.pathname;

    const targetUrl = buildOrgUrl(actualOrgSlug, `${targetPath}${window.location.search ?? ""}`);

    window.location.replace(targetUrl);
  }, [subdomainMismatch, actualOrgSlug]);

  useEffect(() => {
    if (organizationResult?.organization?.onboardingCompleted) {
      navigate("/dashboard", { replace: true });
    }
  }, [organizationResult?.organization?.onboardingCompleted, navigate]);

  useEffect(() => {
    if (!noOrg && org && org.onboardingCompleted) {
      navigate("/dashboard", { replace: true });
    }
  }, [noOrg, org, navigate]);

  useEffect(() => {
    if (noOrg && sessionMetadata && !sessionMetadata.roles?.includes("owner")) {
      console.warn("[Onboarding] Non-owner trying to access onboarding without org");
    }
  }, [noOrg, sessionMetadata]);

  // Auto-hide success message after resend (must be before any early returns to keep hooks order stable)
  useEffect(() => {
    if (resendStatus === "success" && resendMessage) {
      const t = window.setTimeout(() => setResendMessage(null), 5000);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [resendStatus, resendMessage]);

  if (!subdomain && platformHost === null) {
    return (
      <FullscreenMessage
        icon={<Loader size="xl" type="dots" />}
        title="Visit your store subdomain"
        description={
          <>
            Owner onboarding is only available from your secure store URL, for example <Code>store-name.whatthepack.today</Code>.
          </>
        }
      />
    );
  }

  if (isLoading || (isAuthenticated && organizationResult === undefined)) {
    return <FullscreenMessage icon={<Loader size="xl" type="dots" />} title="Loading…" />;
  }

  if (!isAuthenticated) {
    return (
      <FullscreenMessage
        title="Sign in to continue"
        description="You need to sign in with your owner account to complete onboarding."
        actions={
          <Button size="md" onClick={() => loginWithRedirect()}>
            Sign in with Auth0
          </Button>
        }
      />
    );
  }

  if (checkingSubdomainMismatch) {
    return <FullscreenMessage icon={<Loader size="xl" type="dots" />} title="Checking your organization…" />;
  }

  // During initial onboarding, allow authenticated users without org
  // (fresh signups don't have role in JWT yet, but provisioning assigned it in Auth0)
  if (noOrg && !isAuthenticated) {
    return (
      <FullscreenMessage
        title="Owner access required"
        description="Only business owners can complete the initial onboarding. Please sign in with your owner account."
      />
    );
  }

  // Allow onboarding if:
  // 1. User has owner role in session (normal case after JWT refresh)
  // 2. User is authenticated but has no org (fresh signup case)
  const userIsOwner = noOrg ? sessionMetadata?.roles?.includes("owner") || isAuthenticated : isOwner;

  if (!userIsOwner) {
    return (
      <FullscreenMessage
        title="Onboarding is owner-only"
        description="Ask your organization owner to complete onboarding. You'll get access once setup is finished."
      />
    );
  }

  if (subdomainMismatch) {
    return <FullscreenMessage icon={<Loader size="xl" type="dots" />} title="Redirecting to your organization subdomain…" />;
  }

  const slugErrorMessage = getSlugErrorMessage(normalizedSlug, slugUnavailable, slugAvailabilityReason);

  const handleBusinessNameChange = (value: string) => {
    setBusinessName(value);
    if (!slugManuallyEdited) {
      setSlugValue(sanitizeSlug(value));
    }
  };

  const handleSlugChange = (value: string) => {
    setSlugManuallyEdited(true);
    const sanitized = sanitizeSlug(value);
    setSlugValue(sanitized.slice(0, MAX_SLUG_LENGTH));
  };

  const handleResendVerification = async () => {
    if (!user?.email) {
      setResendStatus("error");
      setResendMessage("Email address not available. Try signing out and back in.");
      return;
    }

    setResendStatus("pending");
    setResendMessage(null);
    setResendingEmail(true);

    try {
      const result = await resendVerificationEmail({ email: user.email });

      if (result.alreadyVerified) {
        setResendStatus("success");
        setResendMessage("Email already verified. You can proceed with onboarding.");
        return;
      }

      setResendStatus("success");
      setResendMessage("Verification email sent. Please check your inbox and spam folder.");
    } catch (error) {
      console.error("Failed to resend verification:", error);
      setResendStatus("error");
      let message = "Failed to resend verification email. Contact support if the issue persists.";
      if (typeof (error as { message?: string })?.message === "string") {
        message = (error as { message?: string }).message?.includes("Service not enabled within domain")
          ? "Verification email service is not enabled for this tenant. Contact support to configure Auth0 Management API."
          : ((error as { message?: string }).message ?? message);
      }
      setResendMessage(message);
    } finally {
      setResendingEmail(false);
    }
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();

    if (!noOrg && org?.onboardingCompleted) {
      setFormError("You already have an organization. Redirecting to dashboard...");
      setTimeout(() => navigate("/dashboard", { replace: true }), 1000);
      return;
    }

    if (!isEmailVerified) {
      setFormError("Please verify your email address before completing setup.");
      return;
    }

    const trimmedName = businessName.trim();
    const finalSlug = normalizedSlug || sanitizeSlug(trimmedName);

    if (!trimmedName) {
      setFormError("Business name is required.");
      return;
    }

    if (!finalSlug) {
      setFormError("Subdomain is required.");
      return;
    }

    if (!slugRegex.test(finalSlug)) {
      setFormError("Subdomain can only contain lowercase letters, numbers, and hyphens.");
      return;
    }

    if (isReservedSubdomain(finalSlug)) {
      setFormError("That subdomain is reserved by the platform. Try a different name.");
      return;
    }

    if (slugUnavailable) {
      setFormError("That subdomain is already taken. Try a different name.");
      return;
    }

    setFormError(null);
    setSaving(true);

    try {
      if (noOrg) {
        await completeOnboardingAction({
          storeName: trimmedName,
          slug: finalSlug,
        });

        const isLocalhost =
          typeof window !== "undefined" &&
          (window.location.hostname === "localhost" ||
            window.location.hostname === "127.0.0.1" ||
            window.location.hostname.includes("localhost"));

        if (!isLocalhost && finalSlug !== subdomain && typeof window !== "undefined") {
          const orgUrl = buildOrgUrl(finalSlug, "/");

          await logout({
            logoutParams: {
              returnTo: orgUrl,
            },
          });
          return;
        }

        navigate("/dashboard", { replace: true });
        return;
      }

      if (!org) {
        throw new Error("Organization context is missing. Please refresh the page.");
      }

      const existingOrg = org as ClientOrg;

      if (finalSlug !== existingOrg.slug) {
        await setSlugMutation({ orgId: existingOrg._id, slug: finalSlug });
      }

      await updateOrgMutation({
        orgId: existingOrg._id,
        name: trimmedName,
        onboardingCompleted: true,
      });

      const isLocalhost =
        typeof window !== "undefined" &&
        (window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1" ||
          window.location.hostname.includes("localhost"));

      if (!isLocalhost && finalSlug !== subdomain && typeof window !== "undefined") {
        const orgUrl = buildOrgUrl(finalSlug, "/dashboard");
        window.location.href = orgUrl;
        return;
      }

      navigate("/dashboard", { replace: true });
    } catch (error) {
      console.error("[Onboarding] Error:", error);
      setFormError((error as { message?: string })?.message ?? "Failed to complete onboarding. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box bg="gray.0" mih="100vh">
      <Paper withBorder radius={0} shadow="sm" bg="white" style={{ position: "sticky", top: 0, zIndex: 10 }}>
        <Container size="lg" py="md">
          <Group justify={isLargeScreen ? "space-between" : "center"} align="center" wrap="wrap" gap="sm">
            <Stack gap={2} align={isLargeScreen ? "flex-start" : "center"}>
              <Text size="xs" tt="uppercase" fw={600} c="gray.6" lts={4} ta={isLargeScreen ? "left" : "center"}>
                WHATTHEPACK ONBOARDING
              </Text>
            </Stack>
            <Badge
              variant="light"
              color="brand"
              style={{
                textAlign: "center",
                width: isLargeScreen ? "auto" : "100%",
              }}
            >
              {`${slugValue || org?.slug || subdomain || "your-store"}.whatthepack.today`}
            </Badge>
          </Group>
        </Container>
        {isPlatformDomain ? (
          <Alert variant="light" color="blue" radius={0} ta="center">
            You&apos;re configuring from {platformHost ?? "this domain"}. After saving, we&apos;ll redirect you to your secure
            store domain.
          </Alert>
        ) : null}
        {!isEmailVerified && (
          <Alert variant="light" color="yellow" radius="lg" styles={{ message: { width: "100%" } }} ta="center">
            <Stack gap="sm">
              <Group justify="space-between" align="center" wrap="nowrap" gap="sm">
                <Stack gap={2} flex={1} miw={260}>
                  <Text fw={700}>Email verification required</Text>
                  <Text size="sm" c="gray.7">
                    Please verify your email address{" "}
                    <Badge variant="light" color="yellow">
                      {user?.email}
                    </Badge>{" "}
                    to unlock all features and complete your setup.
                  </Text>
                </Stack>
              </Group>
              {resendMessage ? (
                <Paper
                  withBorder
                  radius="lg"
                  p="xs"
                  bg={resendStatus === "success" ? "green.0" : "red.0"}
                  c={resendStatus === "success" ? "green.7" : "red.7"}
                >
                  <Text size="xs">{resendMessage}</Text>
                </Paper>
              ) : (
                <Text size="xs" c="gray.6">
                  Check your inbox (and spam folder) for the verification email.
                </Text>
              )}
            </Stack>
            <Button
              variant="filled"
              color="yellow"
              size="xs"
              leftSection={<IconMail size={14} />}
              onClick={handleResendVerification}
              loading={resendingEmail}
              mt="md"
            >
              Resend link
            </Button>
          </Alert>
        )}
      </Paper>

      <Container
        size="lg"
        py={isLargeScreen ? "xl" : "md"}
        style={{
          minHeight: isLargeScreen ? "calc(100vh - 200px)" : "auto",
          display: "flex",
          alignItems: isLargeScreen ? "center" : "stretch",
          justifyContent: "center",
        }}
      >
        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing={{ base: "lg", lg: "4rem" }} style={{ width: "100%" }}>
          <Paper withBorder radius="lg" shadow="xs" p={isLargeScreen ? "xl" : "lg"} bg="white">
            <Stack gap="lg">
              <Stack gap={6}>
                <Title order={3}>Before you begin</Title>
                <Text size="sm" c="gray.6">
                  These steps secure your workspace and give staff the right entry point.
                </Text>
              </Stack>
              <List spacing="md" size="sm" c="gray.7">
                {instructions.map((item, index) => (
                  <List.Item
                    key={item}
                    icon={
                      <ThemeIcon radius="lg" size={30} color="brand.5">
                        {index + 1}
                      </ThemeIcon>
                    }
                  >
                    {item}
                  </List.Item>
                ))}
              </List>
              <Divider />
              <Stack gap={4}>
                <Text size="sm" fw={600}>
                  Need support?
                </Text>
                <Text size="sm" c="gray.6">
                  Our team can help you pick a subdomain, configure Auth0, or connect ShipEngine.
                </Text>
                <Anchor href="mailto:support@whatthepack.today" size="sm">
                  support@whatthepack.today
                </Anchor>
              </Stack>
            </Stack>
          </Paper>

          <Paper withBorder radius="lg" shadow="xs" p={isLargeScreen ? "xl" : "lg"} bg="white">
            <form onSubmit={handleSubmit}>
              <Stack gap="lg">
                <Stack gap={6}>
                  <TextInput
                    label="Business name"
                    placeholder="e.g., Lunar Threads Co."
                    value={businessName}
                    onChange={(event) => handleBusinessNameChange(event.currentTarget.value)}
                    disabled={!isEmailVerified}
                    maxLength={80}
                    description="Displayed on dashboards, notifications, and emails."
                  />
                </Stack>

                <Stack gap={6}>
                  <TextInput
                    label="Secure subdomain"
                    placeholder="store-name"
                    value={slugValue}
                    onChange={(event) => handleSlugChange(event.currentTarget.value)}
                    disabled={!isEmailVerified}
                    maxLength={MAX_SLUG_LENGTH}
                    rightSection={
                      <Text size="sm" c="gray.6">
                        .whatthepack.today
                      </Text>
                    }
                    rightSectionWidth={140}
                    error={slugErrorMessage ?? undefined}
                    description={
                      <>
                        This becomes <Code>{`${normalizedSlug || "your-store"}.whatthepack.today`}</Code>. Only lowercase letters,
                        numbers, and hyphens.
                      </>
                    }
                  />
                  {slugCheckLoading ? (
                    <Text size="xs" c="gray.6">
                      Checking availability…
                    </Text>
                  ) : slugErrorMessage ? null : slugAvailability?.available && slugChanged ? (
                    <Text size="xs" c="teal.6">
                      Subdomain available — we&apos;ll redirect you here after saving.
                    </Text>
                  ) : (
                    <Text size="xs" c="gray.5">
                      This choice is final.
                    </Text>
                  )}
                </Stack>

                {formError ? (
                  <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
                    {formError}
                  </Alert>
                ) : null}

                <Divider my="sm" />

                <Group justify="end" align="center">
                  <Button
                    type="submit"
                    loading={saving}
                    disabled={slugCheckLoading || !isEmailVerified || Boolean(slugErrorMessage)}
                  >
                    Complete onboarding
                  </Button>
                </Group>
              </Stack>
            </form>
          </Paper>
        </SimpleGrid>
      </Container>
    </Box>
  );
}

function sanitizeSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, MAX_SLUG_LENGTH);
}

function getSlugErrorMessage(slug: string, unavailable: boolean, reason: SlugAvailabilityReason): string | null {
  if (!slug) {
    return "Enter a subdomain to continue.";
  }
  if (!slugRegex.test(slug)) {
    return "Subdomain can only contain lowercase letters, numbers, and hyphens.";
  }
  if (slug.length < 3) {
    return "Subdomain should be at least 3 characters.";
  }
  if (reason === "reserved") {
    return "This subdomain is reserved by the platform.";
  }
  if (unavailable && reason !== "current") {
    return "Another organization already uses this subdomain.";
  }
  return null;
}

function FullscreenMessage({
  icon,
  title,
  description,
  actions,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Center mih="100vh" bg="gray.0" px="md">
      <Stack align="center" gap="sm" maw={420} ta="center">
        {icon}
        <Title order={2}>{title}</Title>
        {description ? (
          <Text size="sm" c="gray.6">
            {description}
          </Text>
        ) : null}
        {actions}
      </Stack>
    </Center>
  );
}
