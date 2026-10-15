package com.adflow.billing.arch;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.Architectures.layeredArchitecture;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

@AnalyzeClasses(
    packages = "com.adflow.billing",
    importOptions = ImportOption.DoNotIncludeTests.class)
class LayeringTest {

  @ArchTest
  static final ArchRule layers =
      layeredArchitecture()
          .consideringOnlyDependenciesInLayers()
          .layer("Api")
          .definedBy("com.adflow.billing.api..")
          .layer("Service")
          .definedBy("com.adflow.billing.service..")
          .layer("Persistence")
          .definedBy("com.adflow.billing.persistence..")
          .layer("Client")
          .definedBy("com.adflow.billing.client..")
          .layer("Domain")
          .definedBy("com.adflow.billing.domain..")
          .whereLayer("Api")
          .mayNotBeAccessedByAnyLayer()
          .whereLayer("Service")
          .mayOnlyBeAccessedByLayers("Api")
          .whereLayer("Persistence")
          .mayOnlyBeAccessedByLayers("Service")
          .whereLayer("Client")
          .mayOnlyBeAccessedByLayers("Service");

  @ArchTest
  static final ArchRule domainIsFrameworkFree =
      noClasses()
          .that()
          .resideInAPackage("com.adflow.billing.domain..")
          .should()
          .dependOnClassesThat()
          .resideInAnyPackage(
              "org.springframework..",
              "jakarta..",
              "com.adflow.billing.api..",
              "com.adflow.billing.service..",
              "com.adflow.billing.persistence..",
              "com.adflow.billing.client..");

  @ArchTest
  static final ArchRule apiDoesNotTouchPersistence =
      noClasses()
          .that()
          .resideInAPackage("com.adflow.billing.api..")
          .should()
          .dependOnClassesThat()
          .resideInAnyPackage("com.adflow.billing.persistence..", "com.adflow.billing.client..");

  @ArchTest
  static final ArchRule noFloatingPointMoney =
      noClasses()
          .that()
          .resideInAnyPackage("com.adflow.billing.domain..", "com.adflow.billing.persistence..")
          .should()
          .dependOnClassesThat()
          .haveFullyQualifiedName("java.math.BigDecimal");

  @ArchTest
  static final ArchRule controllersAreInApi =
      classes()
          .that()
          .areAnnotatedWith(org.springframework.web.bind.annotation.RestController.class)
          .should()
          .resideInAPackage("com.adflow.billing.api..");
}
