package com.adflow.billing.service;

import com.adflow.billing.domain.Discount;
import com.adflow.billing.domain.InvoiceLine;
import java.util.List;

public record CreateInvoiceCommand(
    String advertiserId, String region, List<InvoiceLine> lines, Discount discount) {}
