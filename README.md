# Website lead delivery

The existing `/api/keycrm` endpoint retains the legacy request contract during rollout. Website consultation forms send `attemptId`, `createdAt` (ISO UTC), `name`, E.164 `phone`, explicit `consent`, `formSource` (`hero`, `offers`, `bottom`), `language` (`uk`, `pl`, `en`), and an optional supported Ukrainian `visaType` label.

For these requests the configured CRM webhook is the primary delivery destination. HTTP 200 with `ok: true` and the matching `receiptId` is returned only after the webhook acknowledges a stored `leadId`. Retries must keep the original phone and `createdAt`, which are the existing CRM deduplication identity. A duplicate acknowledgement skips another secondary KeyCRM copy. The selected visa type is forwarded to CRM and included in the KeyCRM card title. Advertising consent remains separate and defaults to denied.

Run `node --test test/*.test.mjs`. Tests mock both destinations and do not create production leads.
