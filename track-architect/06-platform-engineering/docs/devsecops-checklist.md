# DevSecOps checklist

- [ ] Quality gate (SonarQube) blocks merge; new-code coverage and zero new vulnerabilities
- [ ] Dependency and image scanning (Trivy) fails on HIGH/CRITICAL with a fix available
- [ ] Base images pinned (tag, ideally digest) and rebuilt on a schedule
- [ ] Non-root user, read-only rootfs, all capabilities dropped, seccomp RuntimeDefault
- [ ] No secrets in repo or image; Secrets via external secret manager; secret scanning in CI
- [ ] Default-deny NetworkPolicy with explicit allow rules
- [ ] Resource requests/limits, PDB and HPA on every service
- [ ] Images signed (cosign) and admission policy verifies signature
- [ ] Audit logs shipped to a central searchable store with alerting on auth anomalies
- [ ] IaC (Terraform/Helm) linted and scanned before apply; least-privilege CI credentials (OIDC)
