// convex/auth.config.ts
// Auth0 Configuration for WhatThePack.today

export default {
  providers: [
    {
      domain: process.env.AUTH0_DOMAIN!,
      applicationID: process.env.AUTH0_CLIENT_ID!,
    },
  ],
};
