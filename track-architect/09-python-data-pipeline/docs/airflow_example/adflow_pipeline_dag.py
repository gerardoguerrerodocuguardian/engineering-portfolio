"""EXAMPLE ONLY - NOT EXECUTED, NOT TESTED, NOT PART OF THE PACKAGE.

Shows how the DAG in adflow_pipeline.pipeline.build_dag() maps to Airflow 2.x (TaskFlow-free,
BashOperator for brevity). Airflow is not a dependency of this project; ruff and mypy skip this folder.
"""

from datetime import datetime, timedelta

from airflow import DAG  # type: ignore[import-not-found]
from airflow.operators.bash import BashOperator  # type: ignore[import-not-found]

WORKDIR = "/data/adflow"  # placeholder

with DAG(
    dag_id="adflow_ad_events_batch",
    schedule=timedelta(minutes=30),
    start_date=datetime(2026, 1, 1),
    catchup=False,  # backfills are safe because every step is idempotent
    default_args={"retries": 2, "retry_delay": timedelta(minutes=5)},
) as dag:
    # The CLI runs the whole graph; in Airflow you would split it into one operator per task:
    validate = BashOperator(task_id="validate", bash_command=f"adflow run --workdir {WORKDIR}")
    # load >> (export_parquet, transform); transform >> (dq_checks, forecast); all >> report
    # In a real deployment each task would call a CLI sub-command or Python callable that
    # reads and writes the same warehouse, following pipeline.build_dag().
    check = BashOperator(task_id="dq_gate", bash_command=f"adflow check --workdir {WORKDIR}")
    validate >> check
