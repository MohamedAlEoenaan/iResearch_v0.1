# External decisions still required

1. **Payments:** provider selection and credentials, test webhook signing secret, verification/reconciliation contract. User explicitly requested that payment integration stay blocked; no sandbox success path exists.
2. **Transactional email:** provider selection, verified sender/domain, secure delivery configuration. Verification, reset and invitation delivery remain blocked; new registrations are not automatically verified.
3. **Private research files:** S3-compatible storage, private bucket/residency, malware scanner and deployment access. User explicitly requested that storage stay blocked; actual files cannot enter the QA/delivery workflow yet.
4. **Production hosting and Saudi data residency/privacy:** operator-approved hosting, DB/object-storage location, sensitive research-data handling, backup/restore, monitoring, retention requirements and assessment before deployment.
5. **Custom quotation conversion:** who approves a quotation, how a quotation is agreed, and how it becomes an authorized B2C request. The app saves a custom enquiry draft without pretending the quotation is accepted or paid.

## Resolved by the user

- Release V0.1; complete MVP delivered in phases; specified stack; English interface.
- Official logo/colors retrieved from iresearch.com.sa and recorded in `public/brand/SOURCE.md`.
- Website catalog imported, including the exact reported cents. User confirmed prices are VAT included. Source snapshot: `catalog/website.en.json`; provenance: `catalog/README.md`.

Internal implementation work that remains is listed in `IMPLEMENTATION_PLAN.md`, not presented here as an external blocker.
