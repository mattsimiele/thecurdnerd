export default function PrivacyPolicyPage() {
  return (
    <main className="legal-page">
      <a className="legal-wordmark" href="/thecurdnerd/">The Curd Nerd</a>
      <article>
        <p className="legal-kicker">Curd Nerd Receipt Assistant</p>
        <h1>Privacy policy</h1>
        <p className="legal-updated">Effective October 17, 2026</p>
        <p>This internal business tool helps The Curd Nerd LLC reconcile receipts with accounting transactions. It connects to Google Drive and QuickBooks Online only after an authorized user grants access.</p>
        <h2>Information we process</h2>
        <p>The app processes receipt files and file metadata from the selected Google Drive folder, along with transaction, vendor, category, location, and attachment data from the connected QuickBooks Online company.</p>
        <h2>How information is used</h2>
        <p>Information is used to find likely receipt matches, present them for approval, attach approved receipts to QuickBooks transactions, and update internal operating reports. We do not sell personal information or use connected data for advertising.</p>
        <h2>Storage and security</h2>
        <p>Connection tokens and workflow records are stored in the company&apos;s secured Supabase project. Access is limited to authorized users of this dashboard and the minimum service permissions needed to run the workflow.</p>
        <h2>Sharing and retention</h2>
        <p>Data is shared only with Google, Intuit, Supabase, and GitHub Pages as needed to provide the service. Receipt and transaction records are retained for business accounting purposes. Connection access can be revoked through Google or Intuit account settings.</p>
        <h2>Contact</h2>
        <p>Questions or requests about this policy can be sent to <a href="mailto:info@thecurdnerd.com">info@thecurdnerd.com</a>.</p>
      </article>
    </main>
  );
}
