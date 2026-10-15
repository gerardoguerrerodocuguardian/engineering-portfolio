package io.adflow.bidding.adapters.in.rest;

import io.adflow.bidding.application.port.in.DecideBidUseCase;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/bids")
@Tag(name = "Bids")
class BidController {

    record BidRequest(@NotEmpty List<@NotBlank String> keywords) {
    }

    record BidResponse(boolean won, String campaignId, Long bidCents, Long remainingBudgetCents) {
    }

    private final DecideBidUseCase useCase;

    BidController(DecideBidUseCase useCase) {
        this.useCase = useCase;
    }

    @PostMapping
    @Operation(summary = "Decide a bid",
            description = "Returns the winning campaign (keyword match, highest max bid, budget left) "
                    + "or won=false when no active campaign matches.")
    BidResponse bid(@Valid @RequestBody BidRequest request) {
        return useCase.decide(request.keywords())
                .map(d -> new BidResponse(true, d.campaignId(), d.bidCents(), d.remainingBudgetCents()))
                .orElse(new BidResponse(false, null, null, null));
    }
}
