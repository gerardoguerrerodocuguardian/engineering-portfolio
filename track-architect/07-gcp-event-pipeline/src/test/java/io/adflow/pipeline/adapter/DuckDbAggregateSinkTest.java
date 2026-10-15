package io.adflow.pipeline.adapter;

import io.adflow.pipeline.adapter.out.DuckDbAggregateSink;
import io.adflow.pipeline.application.port.AggregateSink;

class DuckDbAggregateSinkTest extends AggregateSinkContract {
    @Override protected AggregateSink newSink() { return new DuckDbAggregateSink("jdbc:duckdb:"); }
}
