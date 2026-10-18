# Hosted receipt workflow

GitHub Pages serves the dashboard, but it must not hold Google or QuickBooks secrets. The integration steps run in the authenticated `receipt-workflow` Supabase Edge Function and write safe display state to Supabase.

1. `drive-sync` uses Google OAuth to list PDFs under the configured folder, hash each file, and upsert receipt metadata.
2. The QuickBooks API sync imports posted accounting entities. QuickBooks Banking "For review" is not available through the Accounting API, so those open rows are imported from a QuickBooks CSV in the dashboard.
3. `match-receipts` pairs transactions and receipts by account + date + exact cents first. Ambiguous matches are marked `needs_review` and never auto-approved.
4. The dashboard records approval but waits because an unposted Banking row has no QuickBooks API entity ID.
5. After the user posts the row, the next sync finds the posted entity by date and exact cents, downloads the approved Drive PDF, and uploads it with an `AttachableRef` to that entity. Only then does the workflow set `status = 'posted'`.

Store these as Supabase Edge Function secrets, never as `NEXT_PUBLIC_*` values:

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_DRIVE_FOLDER_ID`
- `QUICKBOOKS_CLIENT_ID`, `QUICKBOOKS_CLIENT_SECRET`, `QUICKBOOKS_REFRESH_TOKEN`, `QUICKBOOKS_REALM_ID`
- `SUPABASE_SERVICE_ROLE_KEY`

The browser only receives `NEXT_PUBLIC_RECEIPTS_API_URL` and the public Drive folder URL. A private Drive folder must be shared with the Google OAuth user; the folder link alone is not an API credential.

Deploy the Edge Functions, set the secrets, complete each OAuth consent flow, set `NEXT_PUBLIC_RECEIPTS_API_URL`, then redeploy GitHub Pages. The dashboard already consumes `manager_quickbooks_workflow` and displays matched, approved, uploaded, and posted states.
