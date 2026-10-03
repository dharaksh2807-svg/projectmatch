import { Resend } from "resend";
import { render } from "@react-email/render";
import ApplicationStatusEmail from "@/emails/ApplicationStatusEmail";
import * as React from "react";

// Initialize Resend with the API key from environment variables
const resend = new Resend(process.env.RESEND_API_KEY || "re_dummy");

export async function sendApplicationStatusEmail({
  to,
  applicantName,
  projectTitle,
  roleTitle,
  status,
  projectOwnerName,
  projectUrl,
}: {
  to: string;
  applicantName: string;
  projectTitle: string;
  roleTitle: string;
  status: "ACCEPTED" | "REJECTED";
  projectOwnerName: string;
  projectUrl: string;
}) {
  // Check if Resend API key is configured
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY is not set. Skipping email send.");
    return { success: true, dummy: true };
  }

  try {
    const html = await render(
      React.createElement(ApplicationStatusEmail, {
        applicantName,
        projectTitle,
        roleTitle,
        status,
        projectOwnerName,
        projectUrl,
      })
    );

    const data = await resend.emails.send({
      from: "Project Match <notifications@yourdomain.com>", // Replace with your verified domain
      to: [to],
      subject:
        status === "ACCEPTED"
          ? `🎉 You've been accepted to ${projectTitle}`
          : `Update on your application for ${projectTitle}`,
      html,
    });

    return { success: true, data };
  } catch (error) {
    console.error("Failed to send email:", error);
    return { success: false, error };
  }
}
