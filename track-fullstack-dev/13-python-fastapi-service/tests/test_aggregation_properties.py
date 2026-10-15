from __future__ import annotations

import random

from hypothesis import given
from hypothesis import strategies as st

from app.aggregation import Totals, aggregate


@st.composite
def events(draw: st.DrawFn) -> Totals:
    impressions = draw(st.integers(0, 10**6))
    clicks = draw(st.integers(0, impressions))
    return Totals(impressions, clicks, draw(st.integers(0, 10**7)))


@given(st.lists(events()))
def test_totals_are_sums(evs: list[Totals]) -> None:
    t = aggregate(evs)
    assert t.impressions == sum(e.impressions for e in evs)
    assert t.clicks == sum(e.clicks for e in evs)
    assert t.spend_cents == sum(e.spend_cents for e in evs)


@given(st.lists(events()), st.integers(0, 50))
def test_chunked_aggregation_equals_whole(evs: list[Totals], cut: int) -> None:
    cut = min(cut, len(evs))
    assert aggregate(evs[:cut]).merge(aggregate(evs[cut:])) == aggregate(evs)


@given(st.lists(events()), st.randoms())
def test_order_independent(evs: list[Totals], rnd: random.Random) -> None:
    shuffled = list(evs)
    rnd.shuffle(shuffled)
    assert aggregate(shuffled) == aggregate(evs)


@given(st.lists(events()))
def test_ctr_bounds(evs: list[Totals]) -> None:
    t = aggregate(evs)
    assert 0.0 <= t.ctr <= 1.0
    if t.impressions == 0:
        assert t.ctr == 0.0


@given(events(), events(), events())
def test_merge_associative_with_identity(a: Totals, b: Totals, c: Totals) -> None:
    assert a.merge(b).merge(c) == a.merge(b.merge(c))
    assert a.merge(Totals()) == a
