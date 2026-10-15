package io.adflow.bidding.application.port.in;

import io.adflow.bidding.domain.AdEvent;

public interface ProcessAdEventUseCase {

    enum Result { APPLIED, DUPLICATE, UNKNOWN_CAMPAIGN }

    Result process(AdEvent event);
}
