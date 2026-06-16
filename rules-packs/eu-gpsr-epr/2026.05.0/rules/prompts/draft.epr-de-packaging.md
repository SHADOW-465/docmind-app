# Draft ZSVR / LUCID packaging registration — Germany

Produce a draft `EprRegistrationDe` object with `scheme: "zsvr"`. Required
fields per the schema. Map every packaging component from the canonical entity
into `packagingMaterials` using the schema's material enum:
`paper, cardboard, glass, plastic-pet, plastic-other, metal-steel, metal-aluminium, wood, composite`.

If a material in the source doesn't fit cleanly, choose the closest enum value
and set its field confidence to 0.7 or lower.

Output JSON shape:
```json
{
  "value": { "scheme": "zsvr" },
  "fieldMeta": { "<dot.path.to.field>": { "confidence": 0.0-1.0, "spans": [{"start": 0, "end": 0}] } }
}
```

CANONICAL ENTITY:
{{productCatalogItemJson}}

SCHEME METADATA:
{{schemeMetadataJson}}

OUTPUT SCHEMA:
{{outputSchemaJson}}
