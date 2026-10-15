package com.adflow.billing.api;

import com.adflow.billing.domain.Discount;
import com.adflow.billing.domain.InvoiceLine;
import com.adflow.billing.domain.Money;
import com.adflow.billing.service.CreateInvoiceCommand;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.util.List;

public record CreateInvoiceRequest(
    @NotBlank @Size(max = 64) String advertiserId,
    @NotBlank @Pattern(regexp = "^[A-Z]{2}(-[A-Z0-9]{1,3})?$") String region,
    @NotEmpty @Size(max = 200) List<@Valid @NotNull LineRequest> lines,
    @Valid DiscountRequest discount) {

  public record LineRequest(
      @NotBlank @Size(max = 64) String campaignId,
      @NotBlank @Size(max = 255) String description,
      @Positive long quantity,
      @PositiveOrZero long unitPriceCents) {}

  public record DiscountRequest(@NotNull Type type, @PositiveOrZero long value) {
    public enum Type {
      PERCENT_BPS,
      FIXED_CENTS
    }
  }

  public CreateInvoiceCommand toCommand() {
    List<InvoiceLine> domainLines =
        lines.stream()
            .map(
                l ->
                    new InvoiceLine(
                        l.campaignId(),
                        l.description(),
                        l.quantity(),
                        Money.ofCents(l.unitPriceCents())))
            .toList();
    Discount d =
        discount == null
            ? new Discount.None()
            : switch (discount.type()) {
              case PERCENT_BPS ->
                  new Discount.PercentOff((int) Math.min(discount.value(), 1_000_000));
              case FIXED_CENTS -> new Discount.FixedOff(Money.ofCents(discount.value()));
            };
    return new CreateInvoiceCommand(advertiserId, region, domainLines, d);
  }
}
