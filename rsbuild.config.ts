import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";

export default defineConfig({
  html: {
    meta: {
      charset: {
        charset: "UTF-8",
      },
      description: "What The Pack - AI Mission Control for D2C Logistics",
    },
    favicon: "https://cdn.whatthepack.today/favicon.ico",
    title: "What The Pack",
  },

  performance: {
    removeConsole: true,
  },

  plugins: [pluginReact()],

  server: {
    host: "localhost",
    port: 3000,
  },
});
