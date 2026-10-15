package io.adflow.pipeline.adapter;

import io.adflow.pipeline.adapter.out.InMemoryAggregateSink;
import io.adflow.pipeline.application.port.AggregateSink;

class InMemoryAggregateSinkTest extends AggregateSinkContract {
    @Override protected AggregateSink newSink() { return new InMemoryAggregateSink(); }
}
