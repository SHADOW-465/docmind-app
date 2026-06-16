# Draft Stiftung EAR (WEEE) registration — Germany

Produce a draft `EprRegistrationDe` object with `scheme: "stiftung-ear"`. Use
the canonical ProductCatalogItem and the looked-up scheme metadata. Required
fields per the schema. Where information is missing, set to null and explain
in the per-field gap notes.

Output JSON shape:
```json
{
  "value": { "scheme": "stiftung-ear" },
  "fieldMeta": {
    "<dot.path.to.field>": { "confidence": 0.0-1.0, "spans": [{"start": 0, "end": 0}] }
  }
}
```

WEEE class mapping rules:
- Consumer electronics → "4 — IT and telecommunication equipment" or "5 — Lighting equipment", choose by product subtype
- Portable batteries embedded in device → still WEEE; battery shows on the registration separately

CANONICAL ENTITY:
{{productCatalogItemJson}}

SCHEME METADATA:
{{schemeMetadataJson}}

OUTPUT SCHEMA:
{{outputSchemaJson}}
