package io.adflow.bidding.architecture;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

@AnalyzeClasses(packages = "io.adflow.bidding", importOptions = ImportOption.DoNotIncludeTests.class)
class HexagonalArchitectureTest {

    private static final String BASE = "io.adflow.bidding.";

    @ArchTest
    static final ArchRule domainIsFrameworkFreeAndInwardOnly = noClasses().that().resideInAPackage(BASE + "domain..")
            .should().dependOnClassesThat().resideInAnyPackage(
                    BASE + "application..", BASE + "adapters..", BASE + "config..",
                    "org.springframework..", "jakarta..", "com.fasterxml..", "org.apache.kafka..");

    @ArchTest
    static final ArchRule applicationDoesNotDependOnAdapters = noClasses().that().resideInAPackage(BASE + "application..")
            .should().dependOnClassesThat().resideInAnyPackage(BASE + "adapters..", BASE + "config..");

    @ArchTest
    static final ArchRule applicationDoesNotUseInfrastructureApis = noClasses().that().resideInAPackage(BASE + "application..")
            .should().dependOnClassesThat().resideInAnyPackage("jakarta.persistence..", "org.apache.kafka..",
                    "org.springframework.kafka..", "org.springframework.data..");

    @ArchTest
    static final ArchRule inboundAdaptersDoNotTouchOutboundAdapters = noClasses().that().resideInAPackage(BASE + "adapters.in..")
            .should().dependOnClassesThat().resideInAPackage(BASE + "adapters.out..");

    @ArchTest
    static final ArchRule outboundAdaptersDoNotTouchInboundAdapters = noClasses().that().resideInAPackage(BASE + "adapters.out..")
            .should().dependOnClassesThat().resideInAPackage(BASE + "adapters.in..");

    @ArchTest
    static final ArchRule inboundAdaptersUseOnlyInboundPorts = noClasses().that().resideInAPackage(BASE + "adapters.in..")
            .should().dependOnClassesThat().resideInAnyPackage(BASE + "application.service..", BASE + "application.port.out..");
}
