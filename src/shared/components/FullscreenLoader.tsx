import type { LoaderProps } from "@mantine/core";

import { Center, Loader, Portal } from "@mantine/core";

type FullscreenLoaderProps = {
  size?: LoaderProps["size"];
  color?: LoaderProps["color"];
  bg?: string;
};

export default function FullscreenLoader({ size = "xl", color, bg }: FullscreenLoaderProps) {
  return (
    <Portal>
      <Center h="100vh" w="100vw" bg={bg} style={{ position: "fixed", inset: 0, zIndex: 9999 }}>
        <Loader size={size} type="dots" color={color} />
      </Center>
    </Portal>
  );
}
