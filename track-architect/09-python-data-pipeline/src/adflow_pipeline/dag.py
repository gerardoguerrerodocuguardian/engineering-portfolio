"""Minimal DAG abstraction. Tasks and edges map 1:1 to Airflow operators or Dagster ops."""

from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Generic, TypeVar

C = TypeVar("C")


class CycleError(ValueError):
    pass


@dataclass(frozen=True)
class Task(Generic[C]):
    name: str
    fn: Callable[[C], None]
    deps: tuple[str, ...] = ()


@dataclass(frozen=True)
class TaskRun:
    name: str
    status: str  # success | failed | skipped
    seconds: float
    error: str | None = None


@dataclass
class DAG(Generic[C]):
    name: str
    tasks: dict[str, Task[C]] = field(default_factory=dict)

    def add(self, name: str, fn: Callable[[C], None], deps: tuple[str, ...] = ()) -> None:
        if name in self.tasks:
            raise ValueError(f"duplicate task {name!r}")
        self.tasks[name] = Task(name, fn, deps)

    def order(self) -> list[str]:
        """Deterministic topological order; raises on unknown deps or cycles."""
        for t in self.tasks.values():
            for d in t.deps:
                if d not in self.tasks:
                    raise ValueError(f"task {t.name!r} depends on unknown {d!r}")
        done: list[str] = []
        pending = dict(self.tasks)
        while pending:
            ready = sorted(n for n, t in pending.items() if all(d in done for d in t.deps))
            if not ready:
                raise CycleError(f"cycle among {sorted(pending)}")
            done.append(ready[0])
            del pending[ready[0]]
        return done

    def run(self, ctx: C) -> list[TaskRun]:
        """Run in order; a failure marks every downstream task skipped."""
        runs: list[TaskRun] = []
        bad: set[str] = set()
        for name in self.order():
            task = self.tasks[name]
            if any(d in bad for d in task.deps):
                bad.add(name)
                runs.append(TaskRun(name, "skipped", 0.0))
                continue
            t0 = time.perf_counter()
            try:
                task.fn(ctx)
            except Exception as exc:
                bad.add(name)
                runs.append(TaskRun(name, "failed", time.perf_counter() - t0, repr(exc)))
            else:
                runs.append(TaskRun(name, "success", time.perf_counter() - t0))
        return runs
