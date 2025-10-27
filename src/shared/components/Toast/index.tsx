import type { ReactNode } from "react";

import { useCallback, useEffect, useRef, useState } from "react";

import { ActionIcon, Box, Group, Paper, rem, Stack, Text, ThemeIcon, Transition } from "@mantine/core";
import { IconAlertCircle, IconCircleCheck, IconCircleX, IconInfoCircle, IconX } from "@tabler/icons-react";

type ToastType = "success" | "error" | "warning" | "info";

const ICONS: Record<ToastType, ReactNode> = {
  success: <IconCircleCheck size={18} stroke={2.2} />,
  error: <IconCircleX size={18} stroke={2.2} />,
  warning: <IconAlertCircle size={18} stroke={2.2} />,
  info: <IconInfoCircle size={18} stroke={2.2} />,
};

const TONES: Record<ToastType, string> = {
  success: "teal",
  error: "red",
  warning: "yellow",
  info: "blue",
};

interface ToastProps {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  onClose: (id: string) => void;
}

const Toast = ({ id, message, type, duration = 5000, onClose }: ToastProps) => {
  const [visible, setVisible] = useState(true);
  const dismissTimerRef = useRef<number | undefined>(undefined);

  const handleClose = useCallback(() => {
    setVisible(false);
    dismissTimerRef.current = window.setTimeout(() => {
      onClose(id);
    }, 220);
  }, [id, onClose]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      handleClose();
    }, duration);

    return () => window.clearTimeout(timer);
  }, [duration, handleClose]);

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) {
        window.clearTimeout(dismissTimerRef.current);
      }
    };
  }, []);

  return (
    <Transition mounted={visible} transition="slide-left" duration={220} timingFunction="ease">
      {(transitionStyles) => (
        <Paper role="alert" radius="md" p="md" shadow="lg" withBorder style={transitionStyles} bg="white">
          <Group align="flex-start" gap="sm">
            <ThemeIcon color={TONES[type]} variant="light" radius="md" size={rem(36)}>
              {ICONS[type]}
            </ThemeIcon>
            <Text size="sm" component="div" style={{ flex: 1 }}>
              {message}
            </Text>
            <ActionIcon variant="subtle" color="gray" onClick={handleClose} aria-label="Close notification">
              <IconX size={16} />
            </ActionIcon>
          </Group>
        </Paper>
      )}
    </Transition>
  );
};

// Toast Container
interface ToastContainerProps {
  toasts: Array<{
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
  }>;
  onClose: (id: string) => void;
}

export const ToastContainer = ({ toasts, onClose }: ToastContainerProps) => (
  <Stack
    gap="sm"
    style={{
      position: "fixed",
      top: rem(24),
      right: rem(24),
      pointerEvents: "none",
      zIndex: 4000,
      maxWidth: rem(420),
    }}
  >
    {toasts.map((toast) => (
      <Box key={toast.id} style={{ pointerEvents: "auto" }}>
        <Toast {...toast} onClose={onClose} />
      </Box>
    ))}
  </Stack>
);

// Toast Hook
let toastId = 0;

interface ToastState {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

const listeners: Array<(toasts: ToastState[]) => void> = [];
let toasts: ToastState[] = [];

function emit() {
  for (const listener of listeners) {
    listener(toasts);
  }
}

export function useToast() {
  const [, setToasts] = useState<ToastState[]>(toasts);

  useEffect(() => {
    listeners.push(setToasts);
    return () => {
      const index = listeners.indexOf(setToasts);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, []);

  const showToast = (message: string, type: ToastType = "info", duration?: number) => {
    const id = `toast-${toastId++}`;
    const newToast = { id, message, type, duration };
    toasts = [...toasts, newToast];
    emit();
    return id;
  };

  const closeToast = (id: string) => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  };

  const success = (message: string, duration?: number) => showToast(message, "success", duration);
  const error = (message: string, duration?: number) => showToast(message, "error", duration);
  const warning = (message: string, duration?: number) => showToast(message, "warning", duration);
  const info = (message: string, duration?: number) => showToast(message, "info", duration);

  return {
    toasts,
    showToast,
    closeToast,
    success,
    error,
    warning,
    info,
  };
}

// Global toast instance for use outside React components
export const toast = {
  success: (message: string, duration?: number) => {
    const id = `toast-${toastId++}`;
    toasts = [...toasts, { id, message, type: "success", duration }];
    emit();
  },
  error: (message: string, duration?: number) => {
    const id = `toast-${toastId++}`;
    toasts = [...toasts, { id, message, type: "error", duration }];
    emit();
  },
  warning: (message: string, duration?: number) => {
    const id = `toast-${toastId++}`;
    toasts = [...toasts, { id, message, type: "warning", duration }];
    emit();
  },
  info: (message: string, duration?: number) => {
    const id = `toast-${toastId++}`;
    toasts = [...toasts, { id, message, type: "info", duration }];
    emit();
  },
};
