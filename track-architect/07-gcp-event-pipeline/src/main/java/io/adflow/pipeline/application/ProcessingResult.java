package io.adflow.pipeline.application;

public enum ProcessingResult {
    /** Written to the sink. */
    PROCESSED,
    /** Already seen; acknowledged without side effects. */
    DUPLICATE,
    /** Contract violation; must not be retried forever (route to the dead-letter topic). */
    REJECTED
}
