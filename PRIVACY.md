# Baitlock privacy information

Baitlock sends a URL to the API configured by the extension operator when you browse with the shield enabled. A manual scan may also send visible page text. The optional content-analysis service sends a limited text excerpt to the configured Ollama or Groq provider. Do not scan pages containing sensitive information unless that operator and provider are appropriate for your use.

Authentication tokens are kept in dashboard local storage and extension storage. The API validates sessions and expires access tokens after one hour by default. Signing out revokes the current session; changing a password revokes existing sessions.

Security event records omit page text, URL credentials, query strings and likely secret path segments. These filters cannot recognize every sensitive value in a URL path. The extension keeps up to 200 recent tab scan results locally for up to 24 hours; these local results include the scanned URL. API sessions retain a network prefix rather than a complete client IP. Community votes store the account ID and normalized domain. Chat messages and aggregate security context may be processed by the configured AI provider.

You can clear your events and chat history and delete your account from the dashboard. Account deletion requires your password and removes associated application records. Deployment operators control database backups, server access logs and their retention, which may retain separate copies.

This file describes application behavior. Before publishing, the deployment operator must supply its identity, contact details, public privacy-policy URL, configured providers, retention periods, backup deletion policy and applicable legal disclosures. No analytics or external telemetry provider is configured by this repository.
