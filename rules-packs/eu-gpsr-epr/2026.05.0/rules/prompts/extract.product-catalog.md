# Extract canonical ProductCatalogItem

Given product source text and the target JSON-Schema, extract a single
`ProductCatalogItem` object. For each field:

- Use only information present in the source text. Never invent.
- If a required field cannot be determined, set its value to null (the
  validator will flag it as a gap).
- For each leaf field also emit a confidence score 0.0–1.0 and the character
  span(s) in the source that justify the value (start/end char indexes).

Return JSON of shape:
```json
{
  "value": { "...ProductCatalogItem fields..." },
  "fieldMeta": {
    "<dot.path.to.field>": { "confidence": 0.0-1.0, "spans": [{"start": 0, "end": 0}] }
  }
}
```

SCHEMA:
{{schemaJson}}

CATEGORY ASSIGNED (from classify step):
{{categoryId}}

SOURCE TEXT:
{{sourceText}}
