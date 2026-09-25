# Future Domain Migration Strategy

Moving from a generic `@gmail.com` address (via Gmail SMTP) to a custom domain is strongly recommended for the Campus RSO Platform's long-term email deliverability.

## Why Migrate?
1. **Sending Limits**: Personal Gmail accounts limit outgoing mail to 500 emails per day. As the platform scales, transactional emails (signups, approvals, resets) will quickly hit this cap.
2. **Spam Classification**: Major ESPs (Email Service Providers) often flag automated transactional emails sent from a `@gmail.com` address. 
3. **Authentication (SPF/DKIM/DMARC)**: You cannot configure domain-level authentication for a generic `@gmail.com` address. Custom domains allow you to publish DNS records that prove your system is authorized to send emails, drastically reducing spam rates.
4. **Professionalism**: Emails coming from `noreply@campusrso.com` establish trust better than `rsocampus@gmail.com`.

## Recommended Migration Path

### 1. Purchase and Verify a Custom Domain
Acquire a domain (e.g., `campusrso.com` or `campus-rso.edu`) and connect it to a dedicated transactional email provider.

### 2. Choose a Transactional Email Provider
- **Resend** (Recommended): Modern, developer-friendly, and easy to set up.
- **Amazon SES**: Highly cost-effective at scale but has a steeper learning curve.
- **SendGrid / Postmark**: Industry standards with high deliverability rates.

### 3. Configure DNS Records
Your provider will require you to add specific DNS records to your domain's registrar (Route53, Cloudflare, GoDaddy, etc.):
- **SPF (Sender Policy Framework)**: Authorizes the provider's IP addresses to send emails on your behalf.
- **DKIM (DomainKeys Identified Mail)**: Adds a cryptographic signature to your emails.
- **DMARC (Domain-based Message Authentication, Reporting, and Conformance)**: Instructs receiving servers on what to do if an email fails SPF or DKIM checks (e.g., `p=reject` or `p=quarantine`).

### 4. Update the Platform Configuration
Once the domain is verified, update the Kubernetes Secrets / Environment Variables:
```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=<your_api_key>
EMAIL_FROM="Campus RSO <noreply@campusrso.com>"
```
Since the codebase already uses `nodemailer` and `EMAIL_FROM` environment variables, this change requires zero code refactoring—only infrastructure config updates.
