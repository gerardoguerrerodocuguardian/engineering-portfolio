# Kafka vs Pub/Sub, and AWS equivalents

Based on running both in production-style ad-serving event pipelines. Stated generically, with no
figures tied to any employer. Treat the trade-offs as engineering judgement, not benchmarks.

## Model differences that change your design

| Topic | Kafka | Pub/Sub |
|---|---|---|
| Unit of scale | Partition (you size and rebalance it) | Fully managed; throughput scales without partition planning |
| Ordering | Total order per partition (key -> partition) | Per ordering key, opt-in, regional; a nack blocks that key until redelivery |
| Consumer position | Offset: you can rewind to any point, per consumer group | Per-message ack; replay via `seek` to timestamp/snapshot within retention |
| Redelivery | Rebalance or uncommitted offsets cause replays of a range | Ack deadline expiry or nack replays single messages |
| Dead-lettering | Build it (DLT topic + retry topics) | Built in: `dead_letter_policy` with max delivery attempts |
| Exactly-once | Transactions inside Kafka; not across external stores | `enable_exactly_once_delivery` (pull, regional); still not end to end |
| Retention | Long, cheap, log is the source of truth | Up to 31 days on topic; not a system of record |
| Ops burden | Cluster sizing, upgrades, partition skew, lag tuning (or a managed offering) | Nearly none; quotas and cost tuning instead |
| Fan-out | Many consumer groups reading one log | Many subscriptions, each with its own backlog and policies |
| Cost shape | Provisioned capacity | Pay per data volume; surprises come from large fan-out and retention |

## What I would choose when

- **Kafka**: stream processing with state, long replayable history, strict per-key order at very high
  throughput, or when the log is a product (many teams re-reading it).
- **Pub/Sub**: managed fan-out to services, spiky traffic, small teams that should not run a cluster, native
  integration with BigQuery, Cloud Run and Dataflow.

## Lessons from migrating consumers between them

1. Idempotency has to live in the consumer, in both. Moving transports without it is where duplicates and
   double-counted spend appear.
2. Ordering semantics differ in failure mode: a poisoned message blocks a Kafka partition, or a Pub/Sub ordering
   key. Decide up front how many attempts before dead-lettering.
3. Replay is a different muscle. Kafka: reset offsets. Pub/Sub: seek or republish from the source of truth.
   Plan the backfill path before you need it.
4. Do not carry partition counts over; carry the ordering key (campaign) and size consumers by throughput.
5. Keep the transport behind a port so the migration is an adapter swap with the same contract tests.

## AWS equivalents (rough mapping)

| Need | GCP | AWS |
|---|---|---|
| Managed fan-out topic | Pub/Sub topic + subscriptions | SNS topic + SQS queues per consumer |
| Ordered, per-key delivery | Ordering keys | SQS FIFO (MessageGroupId) or Kinesis shard (partition key) |
| Replayable log at scale | Pub/Sub seek (limited) or Kafka | Kinesis Data Streams, or MSK (managed Kafka) |
| Dead-letter | `dead_letter_policy` | SQS redrive policy to a DLQ |
| Stream to warehouse | BigQuery subscription / Dataflow | Kinesis Firehose to S3/Redshift |
| Ad-hoc analytics | BigQuery (partition + cluster) | Athena over partitioned Parquet in S3 (partition projection) |
| Serverless consumer | Cloud Run / Functions | Lambda (SQS/Kinesis event source) or ECS Fargate |
| Keyless CI auth | Workload Identity Federation | IAM role via GitHub OIDC |

Notable differences: SQS FIFO has throughput limits per message group and 5 minute deduplication window, which
is not a substitute for consumer idempotency; Kinesis scales by shard count and ties ordering to the shard;
Athena bills per byte scanned just like BigQuery on-demand, so partitioning and columnar formats matter equally.
