import { Resend } from 'resend';

const FROM_EMAIL = process.env.FROM_EMAIL ?? 'noreply@solartracker.app';
const APP_URL = 'https://www.solartracker.app';

export async function sendApprovalEmail(toEmail: string): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: FROM_EMAIL,
    to: toEmail,
    subject: 'Your Solar Tracker beta access is ready',
    text: [
      `Hi,`,
      ``,
      `Your Solar Tracker beta access is now active.`,
      ``,
      `Sign in at ${APP_URL} using the same Google account you used when you registered.`,
      ``,
      `Important: you must use the same Google account — signing in with a different account will start a new access request.`,
      ``,
      `If you have any questions, reply to this email or contact us at support@solartracker.app.`,
      ``,
      `— The Solar Tracker team`,
    ].join('\n'),
  });
}
