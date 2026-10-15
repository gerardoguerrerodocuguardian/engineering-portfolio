# Cross-cloud mapping: AWS <-> GCP <-> Azure

Counterparts: [03-learning-platform-aws](../../03-learning-platform-aws/README.md) and [07-gcp-event-pipeline](../../07-gcp-event-pipeline/README.md). "Equivalent" is approximate; the right-hand column is the honest part.

| Concern | AWS | GCP | Azure (this project) | Honest trade-off |
|---|---|---|---|---|
| Serverless containers | ECS Fargate | Cloud Run | Container Apps | Cloud Run has the simplest model and fastest scale-to-zero. Container Apps adds KEDA (any event source) and Dapr, but its VNet/subnet and environment concepts are heavier. Fargate has no scale-to-zero. |
| Event-driven autoscaling | App Auto Scaling on SQS metrics (custom) | Cloud Run concurrency; GKE KEDA | KEDA built into Container Apps | Native KEDA on queue depth is Azure's strongest point here. Needs data-plane rights incl. management claims for depth. |
| Messaging | SNS + SQS (+ DLQ) | Pub/Sub (+ DLQ topic) | Service Bus topic + subscription (+ built-in DLQ) | Service Bus has sessions, duplicate detection, transactions. Pub/Sub is simpler and global. Private endpoints need Premium (~US$670/month per messaging unit, order of magnitude), a large step from Standard. |
| Relational DB | RDS PostgreSQL | Cloud SQL / AlloyDB | PostgreSQL Flexible Server | Comparable. Azure supports Entra-only auth with zone-redundant HA; RDS IAM auth needs token plumbing too. |
| Document DB | DynamoDB | Firestore | Cosmos DB (Mongo/NoSQL API) | Cosmos RU/s planning is the cost footgun; DynamoDB on-demand is the easiest to reason about. |
| Secrets/keys | Secrets Manager + KMS | Secret Manager + Cloud KMS | Key Vault (RBAC) | Key Vault holds secrets, keys and certs in one service; throttling limits matter at high read rates. |
| Workload identity | IAM roles for tasks | Service accounts | Managed identities (user-assigned) | Azure identities are resources scoped by RBAC at any level; propagation of new role assignments can take minutes. |
| CI federation | IAM OIDC provider + role | Workload Identity Federation | Entra federated credentials / WIF service connection | Equivalent; Azure DevOps needs a service connection, GitHub needs subject-per-environment credentials. |
| Auth / JWT | Cognito | Identity Platform / IAP | Entra ID (workforce) / External ID (customers) | Entra is excellent for workforce; customer-facing identity (External ID) is a different product with its own pricing. |
| Observability | CloudWatch | Cloud Logging/Monitoring | Log Analytics + Application Insights | KQL is powerful; ingestion priced per GB, so caps and sampling matter. |
| Edge / CDN / WAF | CloudFront + WAF | Cloud CDN + Cloud Armor | Front Door + WAF | See [edge.md](edge.md). |
| Private connectivity | VPC endpoints | Private Service Connect | Private endpoints + private DNS zones | Azure private DNS wiring is the most common source of "works in dev, fails in prod". |
| IaC | Terraform | Terraform | Bicep (ARM) | Bicep: first-class day-0 Azure support, no state file, `what-if`. No cross-cloud reuse; Terraform azurerm remains valid for multi-cloud shops. |
| Analytics sink | Athena/Redshift | BigQuery | Synapse / Fabric / ADX | Not part of this project; BigQuery is the simplest of the three. |
