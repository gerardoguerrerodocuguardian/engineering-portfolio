package io.adflow.bidding.application.port.in;

import io.adflow.bidding.domain.BidDecision;
import java.util.Collection;
import java.util.Optional;

public interface DecideBidUseCase {
    Optional<BidDecision> decide(Collection<String> keywords);
}
