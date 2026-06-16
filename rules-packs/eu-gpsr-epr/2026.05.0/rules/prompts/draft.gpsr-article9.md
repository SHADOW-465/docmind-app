# Draft GPSR Article 9 safety notice

Produce a draft `GpsrSafetyNotice` per the schema. Required: at least one
warning, instructionsForUse non-empty, languages list with at least 'de' for
the German market plus 'en' if the source uses English.

If euResponsiblePerson is not in source, leave the object out (it's optional
in the schema). The validator will flag the gap only if the manufacturer is
based outside the EU — that decision lives in the validate primitive.

Output JSON shape:
```json
{
  "value": { "product": {} },
  "fieldMeta": { "<dot.path.to.field>": { "confidence": 0.0-1.0, "spans": [{"start": 0, "end": 0}] } }
}
```

CANONICAL ENTITY:
{{productCatalogItemJson}}

OUTPUT SCHEMA:
{{outputSchemaJson}}
