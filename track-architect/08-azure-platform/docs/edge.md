# Edge: Front Door vs Application Gateway (note, not implemented)

The template stops at the Container Apps environment (internal in prod). The edge is intentionally not templated here because it needs a custom domain, certificates and WAF policy decisions that are tenant-specific.

| Option | Use when | Notes |
|---|---|---|
| Azure Front Door Premium + Private Link to the internal Container Apps environment | Global audience, CDN/static assets, managed WAF, no public origin | Private Link origin needs manual approval of the private endpoint connection; Premium costs a fixed base fee plus requests/egress. Closest to the CloudFront and Cloud CDN setups in the AWS and GCP projects. |
| Application Gateway v2 (WAF_v2) in its own subnet | Single region, regional WAF, VNet-only/hybrid access, mTLS or path rewrites | Fixed capacity-unit cost. Points to the environment's static IP; needs a dedicated subnet and an A record in the private zone. |
| Both | Global front door, regional gateway for internal traffic | More moving parts; justify with a real requirement. |

Recommendation: Front Door Premium with Private Link for internet-facing APIs, plus WAF in Prevention mode, and `X-Azure-FDID` header validation (or Private Link only) to prevent bypassing the edge. The API validates JWTs itself, so the edge is defence in depth, not the authentication boundary.
