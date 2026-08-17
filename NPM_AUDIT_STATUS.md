# État des dépendances npm — StockFlow vNext

> Date : 2026-06-23  
> Commande : `npm audit --audit-level=high --json`

---

## Résultat

```json
{
  "auditReportVersion": 2,
  "vulnerabilities": {},
  "metadata": {
    "vulnerabilities": {
      "info": 0,
      "low": 0,
      "moderate": 0,
      "high": 0,
      "critical": 0,
      "total": 0
    },
    "dependencies": {
      "prod": 282,
      "dev": 562,
      "optional": 104,
      "peer": 0,
      "peerOptional": 0,
      "total": 938
    }
  }
}
```

**Aucune vulnérabilité de niveau high ou critical** n'est détectée actuellement.

---

## Notes

- Le job `audit` de la CI utilise `--audit-level=high`, donc le pipeline est vert sur ce point.
- Le repo compte **938 dépendances totales** ; il est recommandé d'activer Dependabot ou Renovate pour surveiller l'évolution.
- L'alerte historique mentionnée dans `AUDIT_SYNTHESIS.md` (Phase 4 — "Résoudre `npm audit` / Dependabot") peut être considérée comme traitée pour le seuil high/critical.
