/* Checks your SMTP settings and (optionally) sends a test email.
 *   npm run mail:test                  -> verifies the SMTP login only
 *   npm run mail:test -- you@gmail.com -> verifies, then sends a test email to that address */
const mailer = require('../src/mailer');
const config = require('../src/config');

(async () => {
  const s = config.smtp;
  console.log(`SMTP_HOST=${s.host || '(empty)'}  SMTP_PORT=${s.port}  SMTP_SECURE=${s.secure}  SMTP_USER=${s.user || '(empty)'}  SMTP_PASS=${s.pass ? '(set, ' + s.pass.length + ' chars)' : '(empty)'}`);
  console.log(`SMTP_FROM=${s.from}`);
  const v = await mailer.verify();
  console.log((v.ok ? 'OK   ' : 'FAIL ') + v.message);
  if (!v.ok) process.exit(1);
  const to = process.argv[2];
  if (to) {
    const r = await mailer.sendMail({ to, subject: 'CivicConnect test email', text: 'SMTP is working.', html: mailer.layout({ heading: 'SMTP is working', body: '<p>Test email from CivicConnect.</p>' }) });
    console.log(r.sent ? `OK   test email sent to ${to} (check Inbox and Spam)` : 'FAIL ' + r.reason);
    process.exit(r.sent ? 0 : 1);
  }
})();
