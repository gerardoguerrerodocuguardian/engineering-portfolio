package com.adflow.billing.config;

import com.adflow.billing.client.HttpTaxRateClient;
import com.adflow.billing.client.TaxClientProperties;
import com.adflow.billing.client.TaxRateClient;
import java.time.Clock;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableCaching
public class AppConfig {

  @Bean
  Clock clock() {
    return Clock.systemUTC();
  }

  @Bean
  TaxRateClient taxRateClient(TaxClientProperties props) {
    return new HttpTaxRateClient(props);
  }
}
