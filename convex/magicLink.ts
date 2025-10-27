// convex/magicLink.ts

import { Email } from "@convex-dev/auth/providers/Email";
import { Resend as ResendAPI } from "resend";

import { MagicLinkEmailHtmlString } from "../src/features/auth/templates/MagicLinkEmailTemplate";

export const ResendMagicLink = Email({
  id: "resend-magic-link",
  apiKey: process.env.RESEND_API_KEY as string,
  maxAge: 10 * 60, // 10 minutes
  async sendVerificationRequest({ identifier: email, expires, token, provider }) {
    const minutesUntilExpiry = Math.floor((+expires - Date.now()) / (60 * 1000));

    // Create magic link URL
    const magicLink = `${process.env.SITE_URL}/link?token=${token}&email=${encodeURIComponent(email)}`;

    const resend = new ResendAPI(provider.apiKey);

    const { error } = await resend.emails.send({
      from: "What The Pack <accounts@whatthepack.today>",
      to: [email],
      subject: "Sign in to What The Pack",
      html: MagicLinkEmailHtmlString({
        magicLink,
        minutesUntilExpiry,
      }),
    });

    if (error) {
      throw new Error(`Could not send email: ${error.message}`);
    }
  },
});
