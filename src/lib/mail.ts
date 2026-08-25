import { Resend } from "resend";

const hasResendKey =
  process.env.RESEND_API_KEY &&
  process.env.RESEND_API_KEY !== "re_placeholder_key";

const resend = hasResendKey ? new Resend(process.env.RESEND_API_KEY!) : null;

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "noreply@projectmatch.dev";

export interface MailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send an email via Resend. Silently logs and returns false on failure
 * so email errors never crash a request.
 */
export async function sendMail(opts: MailOptions): Promise<boolean> {
  if (!resend) {
    // Dev mode: just log the email intent
    console.log("[mail:dev] Would send email:", {
      to: opts.to,
      subject: opts.subject,
    });
    return true;
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });

    if (error) {
      console.error("[mail] Resend error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[mail] Unexpected error sending email:", err);
    return false;
  }
}

// ─── Email Templates ─────────────────────────────────────────────────────────

function baseTemplate(title: string, body: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0f0f13;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#1a1a24;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:32px 40px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:36px;height:36px;background:rgba(255,255,255,0.15);border-radius:10px;display:flex;align-items:center;justify-content:center;">
          <span style="font-size:18px;">✦</span>
        </div>
        <span style="color:white;font-size:18px;font-weight:700;letter-spacing:-0.3px;">ProjectMatch</span>
      </div>
    </div>
    <!-- Body -->
    <div style="padding:36px 40px;color:#e2e2ea;">
      ${body}
    </div>
    <!-- Footer -->
    <div style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
      <p style="color:#6b6b85;font-size:12px;margin:0;">
        © ${new Date().getFullYear()} ProjectMatch — AI-powered team formation.
        <br />You received this email because of activity on your account.
      </p>
    </div>
  </div>
</body>
</html>`;
}

// Candidate applied to a role — notify the project owner
export function newApplicationEmail(opts: {
  ownerName: string;
  candidateName: string;
  roleName: string;
  projectTitle: string;
  projectUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `New application for ${opts.roleName} on "${opts.projectTitle}"`,
    html: baseTemplate(
      "New Application Received",
      `
      <h2 style="margin:0 0 8px;color:#fff;font-size:22px;font-weight:700;">New Application Received 🎉</h2>
      <p style="margin:0 0 24px;color:#a0a0be;font-size:15px;line-height:1.6;">
        Hi ${opts.ownerName}, <strong style="color:#e2e2ea;">${opts.candidateName}</strong> just applied for the
        <strong style="color:#a78bfa;">${opts.roleName}</strong> role on your project
        <strong style="color:#e2e2ea;">"${opts.projectTitle}"</strong>.
      </p>
      <a href="${opts.projectUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:white;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px;">
        Review Applicant
      </a>
      `
    ),
  };
}

// Owner invited a candidate — notify the candidate
export function newInviteEmail(opts: {
  candidateName: string;
  ownerName: string;
  roleName: string;
  projectTitle: string;
  projectUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `You've been invited to join "${opts.projectTitle}"`,
    html: baseTemplate(
      "Team Invitation",
      `
      <h2 style="margin:0 0 8px;color:#fff;font-size:22px;font-weight:700;">You're Invited! 🚀</h2>
      <p style="margin:0 0 24px;color:#a0a0be;font-size:15px;line-height:1.6;">
        Hi ${opts.candidateName}, <strong style="color:#e2e2ea;">${opts.ownerName}</strong> has invited you to join
        <strong style="color:#e2e2ea;">"${opts.projectTitle}"</strong> as a
        <strong style="color:#a78bfa;">${opts.roleName}</strong>.
        Head over to review and accept!
      </p>
      <a href="${opts.projectUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:white;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px;">
        View Invitation
      </a>
      `
    ),
  };
}

// Application accepted — notify the candidate
export function applicationAcceptedEmail(opts: {
  candidateName: string;
  roleName: string;
  projectTitle: string;
  projectUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `Congratulations! You've been accepted to "${opts.projectTitle}"`,
    html: baseTemplate(
      "Application Accepted",
      `
      <h2 style="margin:0 0 8px;color:#fff;font-size:22px;font-weight:700;">You're In! 🎊</h2>
      <p style="margin:0 0 24px;color:#a0a0be;font-size:15px;line-height:1.6;">
        Congratulations ${opts.candidateName}! Your application for the
        <strong style="color:#a78bfa;">${opts.roleName}</strong> role on
        <strong style="color:#e2e2ea;">"${opts.projectTitle}"</strong> has been
        <strong style="color:#34d399;">accepted</strong>. You are now part of the team!
      </p>
      <a href="${opts.projectUrl}" style="display:inline-block;background:linear-gradient(135deg,#059669,#10b981);color:white;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px;">
        View Your Team
      </a>
      `
    ),
  };
}

// Application declined — notify the candidate
export function applicationDeclinedEmail(opts: {
  candidateName: string;
  roleName: string;
  projectTitle: string;
}): { subject: string; html: string } {
  return {
    subject: `Application update for "${opts.projectTitle}"`,
    html: baseTemplate(
      "Application Update",
      `
      <h2 style="margin:0 0 8px;color:#fff;font-size:22px;font-weight:700;">Application Update</h2>
      <p style="margin:0 0 24px;color:#a0a0be;font-size:15px;line-height:1.6;">
        Hi ${opts.candidateName}, thank you for your interest in the
        <strong style="color:#a78bfa;">${opts.roleName}</strong> role on
        <strong style="color:#e2e2ea;">"${opts.projectTitle}"</strong>.
        Unfortunately, the team has decided to move forward with other candidates at this time.
        Keep building and applying — your next great team is waiting!
      </p>
      `
    ),
  };
}

// Owner accepted an invite — notify the owner that candidate joined
export function inviteAcceptedEmail(opts: {
  ownerName: string;
  candidateName: string;
  roleName: string;
  projectTitle: string;
  projectUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `${opts.candidateName} accepted your invite to "${opts.projectTitle}"`,
    html: baseTemplate(
      "Invite Accepted",
      `
      <h2 style="margin:0 0 8px;color:#fff;font-size:22px;font-weight:700;">Your team just got stronger! 💪</h2>
      <p style="margin:0 0 24px;color:#a0a0be;font-size:15px;line-height:1.6;">
        Hi ${opts.ownerName}, <strong style="color:#e2e2ea;">${opts.candidateName}</strong> has accepted your invitation 
        to join <strong style="color:#e2e2ea;">"${opts.projectTitle}"</strong> as
        <strong style="color:#a78bfa;">${opts.roleName}</strong>.
      </p>
      <a href="${opts.projectUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:white;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px;">
        View Project
      </a>
      `
    ),
  };
}
