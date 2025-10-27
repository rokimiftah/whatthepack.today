import type { LoaderProps } from "@mantine/core";

import { Center, Loader } from "@mantine/core";

type FullscreenLoaderProps = {
  size?: LoaderProps["size"];
  color?: LoaderProps["color"];
  bg?: string;
};

export default function FullscreenLoader({ size = "xl", color, bg }: FullscreenLoaderProps) {
  return (
    <Center h="100vh" w="100%" bg={bg}>
      <Loader size={size} type="dots" color={color} />
    </Center>
  );
}
