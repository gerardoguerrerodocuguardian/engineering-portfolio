package com.adflow.billing.api;

import com.adflow.billing.service.InvoiceService;
import com.adflow.billing.service.InvoiceView;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/invoices")
public class InvoiceController {

  private final InvoiceService service;

  public InvoiceController(InvoiceService service) {
    this.service = service;
  }

  @PostMapping
  public ResponseEntity<InvoiceView> create(@Valid @RequestBody CreateInvoiceRequest request) {
    InvoiceView created = service.create(request.toCommand());
    return ResponseEntity.created(URI.create("/v1/invoices/" + created.id())).body(created);
  }

  @GetMapping("/{id}")
  public InvoiceView get(@PathVariable UUID id) {
    return service.get(id);
  }

  @PostMapping("/{id}/void")
  public InvoiceView voidInvoice(@PathVariable UUID id) {
    return service.voidInvoice(id);
  }
}
