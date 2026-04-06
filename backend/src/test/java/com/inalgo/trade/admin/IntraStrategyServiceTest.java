package com.inalgo.trade.admin;

import com.inalgo.trade.entity.IntraStrategyEntity;
import com.inalgo.trade.entity.IntraStrategyVersionEntity;
import com.inalgo.trade.entity.IntraTradeExecutionEntity;
import com.inalgo.trade.repository.IntraStrategyPerfSnapshotRepository;
import com.inalgo.trade.repository.IntraStrategyRepository;
import com.inalgo.trade.repository.IntraStrategyVersionRepository;
import com.inalgo.trade.repository.IntraTradeExecutionRepository;
import jakarta.validation.ValidationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class IntraStrategyServiceTest {

    @Mock IntraStrategyRepository strategyRepository;
    @Mock IntraStrategyVersionRepository versionRepository;
    @Mock IntraStrategyPerfSnapshotRepository perfSnapshotRepository;
    @Mock IntraTradeExecutionRepository executionRepository;
    @Mock IntraStrategyValidationEngine validationEngine;
    @Mock IntraStrategyMapperSupport mapper;
    @Mock IntraStrategyImportService importService;
    @Mock IntraStrategyDraftSupport draftSupport;

    private IntraStrategyService service;

    private static final String TENANT = "local-desktop";
    private static final String USER   = "admin";

    @BeforeEach
    void setUp() {
        service = new IntraStrategyService(
                strategyRepository, versionRepository, perfSnapshotRepository,
                executionRepository, validationEngine, mapper, importService, draftSupport);

        // common mapper stubs
        lenient().when(mapper.requireText(any(), any())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(mapper.normalizeSort(any())).thenReturn("RECENT_EDITED");
        // TimeframeFilter("", null) matches everything (empty unit = no filter)
        lenient().when(mapper.parseTimeframeFilter(any()))
                .thenReturn(new IntraStrategyMapperSupport.TimeframeFilter("", null));
        lenient().when(mapper.comparatorForSort(any())).thenReturn((a, b) -> 0);
    }

    // ─── listLibrary ──────────────────────────────────────────────────────────

    @Test
    void listLibrary_returnsAllStrategiesForUser() {
        IntraStrategyEntity e1 = strategyEntity("Alpha", "DRAFT", true, false);
        IntraStrategyEntity e2 = strategyEntity("Beta",  "PAPER_READY", true, true);
        when(strategyRepository.findAllByTenantIdAndUsername(TENANT, USER)).thenReturn(List.of(e1, e2));
        when(perfSnapshotRepository.findAllByTenantIdAndUsername(TENANT, USER)).thenReturn(List.of());
        when(mapper.toLibraryItem(any(), any())).thenReturn(libraryItem("Alpha"));

        var response = service.listLibrary(TENANT, USER, null, null, null, null, null, null, null, 0, 10);

        assertThat(response.totalElements()).isEqualTo(2);
        assertThat(response.content()).hasSize(2);
    }

    @Test
    void listLibrary_filtersByStatus() {
        IntraStrategyEntity draft     = strategyEntity("D", "DRAFT", true, false);
        IntraStrategyEntity published = strategyEntity("P", "PAPER_READY", true, true);
        when(strategyRepository.findAllByTenantIdAndUsername(TENANT, USER)).thenReturn(List.of(draft, published));
        when(perfSnapshotRepository.findAllByTenantIdAndUsername(TENANT, USER)).thenReturn(List.of());
        when(mapper.toLibraryItem(any(), any())).thenAnswer(inv -> {
            IntraStrategyEntity e = inv.getArgument(0);
            return libraryItem(e.getStrategyName());
        });

        var response = service.listLibrary(TENANT, USER, null, "PAPER_READY", null, null, null, null, null, 0, 10);

        assertThat(response.totalElements()).isEqualTo(1);
        assertThat(response.content().get(0).strategyName()).isEqualTo("P");
    }

    @Test
    void listLibrary_filtersByLiveEligibility() {
        IntraStrategyEntity paperOnly = strategyEntity("PaperOnly", "PAPER_READY", true, false);
        IntraStrategyEntity liveReady = strategyEntity("LiveReady", "LIVE_READY",  true, true);
        when(strategyRepository.findAllByTenantIdAndUsername(TENANT, USER)).thenReturn(List.of(paperOnly, liveReady));
        when(perfSnapshotRepository.findAllByTenantIdAndUsername(TENANT, USER)).thenReturn(List.of());
        when(mapper.toLibraryItem(any(), any())).thenAnswer(inv -> {
            IntraStrategyEntity e = inv.getArgument(0);
            return libraryItem(e.getStrategyName());
        });

        var response = service.listLibrary(TENANT, USER, null, null, null, null, null, true, null, 0, 10);

        assertThat(response.totalElements()).isEqualTo(1);
        assertThat(response.content().get(0).strategyName()).isEqualTo("LiveReady");
    }

    @Test
    void listLibrary_paginatesCorrectly() {
        var entities = List.of(
                strategyEntity("A", "DRAFT", true, false),
                strategyEntity("B", "DRAFT", true, false),
                strategyEntity("C", "DRAFT", true, false));
        when(strategyRepository.findAllByTenantIdAndUsername(TENANT, USER)).thenReturn(entities);
        when(perfSnapshotRepository.findAllByTenantIdAndUsername(TENANT, USER)).thenReturn(List.of());
        when(mapper.toLibraryItem(any(), any())).thenReturn(libraryItem("x"));

        var page0 = service.listLibrary(TENANT, USER, null, null, null, null, null, null, null, 0, 2);
        var page1 = service.listLibrary(TENANT, USER, null, null, null, null, null, null, null, 1, 2);

        assertThat(page0.content()).hasSize(2);
        assertThat(page0.totalPages()).isEqualTo(2);
        assertThat(page1.content()).hasSize(1);
        assertThat(page1.number()).isEqualTo(1);
    }

    @Test
    void listLibrary_rejectsInvalidStatusFilter() {
        assertThatThrownBy(() ->
                service.listLibrary(TENANT, USER, null, "INVALID_STATUS", null, null, null, null, null, 0, 10))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("Invalid status filter");
    }

    @Test
    void listLibrary_searchFiltersPartialName() {
        IntraStrategyEntity nifty   = strategyEntity("Nifty Scalp", "DRAFT", true, false);
        IntraStrategyEntity sensex  = strategyEntity("Sensex Break", "DRAFT", true, false);
        when(strategyRepository.findAllByTenantIdAndUsername(TENANT, USER)).thenReturn(List.of(nifty, sensex));
        when(perfSnapshotRepository.findAllByTenantIdAndUsername(TENANT, USER)).thenReturn(List.of());
        when(mapper.toLibraryItem(any(), any())).thenAnswer(inv -> {
            IntraStrategyEntity e = inv.getArgument(0);
            return libraryItem(e.getStrategyName());
        });

        var response = service.listLibrary(TENANT, USER, "nifty", null, null, null, null, null, null, 0, 10);

        assertThat(response.totalElements()).isEqualTo(1);
        assertThat(response.content().get(0).strategyName()).isEqualTo("Nifty Scalp");
    }

    // ─── createDraft ──────────────────────────────────────────────────────────

    @Test
    void createDraft_persistsStrategyInDraftStatusAtVersionOne() {
        var builderModel = builderModel("Morning Scalp");
        when(draftSupport.normalizeBuilder(any())).thenReturn(builderModel);
        when(validationEngine.validate(any())).thenReturn(validResult(true, true));
        when(strategyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(draftSupport.createVersion(any(), any(Integer.class), anyString(), any(), any()))
                .thenReturn(mock(IntraStrategyVersionEntity.class));
        when(draftSupport.toDetails(any(), any(), any())).thenReturn(detailsResponse("Morning Scalp"));

        var response = service.createDraft(TENANT, createRequest(USER, "Morning Scalp"));

        assertThat(response).isNotNull();
        // createDraft calls save twice: initial persist + after setting version ID
        ArgumentCaptor<IntraStrategyEntity> captor = ArgumentCaptor.forClass(IntraStrategyEntity.class);
        verify(strategyRepository, times(2)).save(captor.capture());
        var firstSave = captor.getAllValues().get(0);
        assertThat(firstSave.getStatus()).isEqualTo("DRAFT");
        assertThat(firstSave.getPublishState()).isEqualTo("DRAFT");
        assertThat(firstSave.getCurrentVersion()).isEqualTo(1);
    }

    @Test
    void createDraft_throwsOnDuplicateStrategyName() {
        var builderModel = builderModel("Duplicate Name");
        when(draftSupport.normalizeBuilder(any())).thenReturn(builderModel);
        when(validationEngine.validate(any())).thenReturn(validResult(true, true));
        when(strategyRepository.save(any())).thenThrow(DataIntegrityViolationException.class);

        assertThatThrownBy(() -> service.createDraft(TENANT, createRequest(USER, "Duplicate Name")))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("Strategy name already exists");
    }

    // ─── updateDraft ──────────────────────────────────────────────────────────

    @Test
    void updateDraft_incrementsVersionAndResetsToDraft() {
        IntraStrategyEntity existing = strategyEntity("Old Name", "PAPER_READY", true, true);
        setId(existing, 10L);
        when(strategyRepository.findByIdAndTenantId(10L, TENANT)).thenReturn(Optional.of(existing));
        var builderModel = builderModel("New Name");
        when(draftSupport.normalizeBuilder(any())).thenReturn(builderModel);
        when(validationEngine.validate(any())).thenReturn(validResult(true, true));
        when(draftSupport.createVersion(any(), any(Integer.class), anyString(), any(), any()))
                .thenReturn(mock(IntraStrategyVersionEntity.class));
        when(strategyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(draftSupport.toDetails(any(), any(), any())).thenReturn(detailsResponse("New Name"));

        service.updateDraft(TENANT, 10L, updateRequest(USER, "New Name"));

        ArgumentCaptor<IntraStrategyEntity> captor = ArgumentCaptor.forClass(IntraStrategyEntity.class);
        verify(strategyRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo("DRAFT");
        assertThat(captor.getValue().getPublishState()).isEqualTo("DRAFT");
        assertThat(captor.getValue().getCurrentVersion()).isEqualTo(2); // was 1, now 2
    }

    @Test
    void updateDraft_throwsForArchivedStrategy() {
        IntraStrategyEntity archived = strategyEntity("X", "ARCHIVED", false, false);
        setId(archived, 5L);
        when(strategyRepository.findByIdAndTenantId(5L, TENANT)).thenReturn(Optional.of(archived));

        assertThatThrownBy(() -> service.updateDraft(TENANT, 5L, updateRequest(USER, "X")))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("Archived strategies cannot be edited");
    }

    // ─── publish ──────────────────────────────────────────────────────────────

    @Test
    void publish_toPaperReady_succeeds_whenPaperEligible() {
        IntraStrategyEntity strategy = strategyEntity("S", "DRAFT", false, false);
        setId(strategy, 20L);
        IntraStrategyVersionEntity version = mock(IntraStrategyVersionEntity.class);
        when(strategyRepository.findByIdAndTenantId(20L, TENANT)).thenReturn(Optional.of(strategy));
        when(versionRepository.findByStrategyIdAndVersionAndTenantIdAndUsername(any(), any(), any(), any()))
                .thenReturn(Optional.of(version));
        when(draftSupport.fromVersion(version)).thenReturn(builderModel("S"));
        when(validationEngine.validate(any())).thenReturn(validResult(true, false));
        when(mapper.normalizePublishTarget("PAPER_READY")).thenReturn("PAPER_READY");
        when(versionRepository.save(any())).thenReturn(version);
        when(strategyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(draftSupport.toDetails(any(), any(), any())).thenReturn(detailsResponse("S"));
        when(mapper.toJson(any())).thenReturn("[]");

        var result = service.publish(TENANT, 20L, publishRequest(USER, "PAPER_READY"));

        assertThat(result).isNotNull();
        ArgumentCaptor<IntraStrategyEntity> captor = ArgumentCaptor.forClass(IntraStrategyEntity.class);
        verify(strategyRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo("PAPER_READY");
        assertThat(captor.getValue().getPublishState()).isEqualTo("PUBLISHED");
    }

    @Test
    void publish_toLiveReady_fails_whenNotLiveEligible() {
        IntraStrategyEntity strategy = strategyEntity("S", "DRAFT", true, false);
        setId(strategy, 21L);
        IntraStrategyVersionEntity version = mock(IntraStrategyVersionEntity.class);
        when(strategyRepository.findByIdAndTenantId(21L, TENANT)).thenReturn(Optional.of(strategy));
        when(versionRepository.findByStrategyIdAndVersionAndTenantIdAndUsername(any(), any(), any(), any()))
                .thenReturn(Optional.of(version));
        when(draftSupport.fromVersion(version)).thenReturn(builderModel("S"));
        when(validationEngine.validate(any())).thenReturn(validResult(true, false)); // liveEligible=false
        when(mapper.normalizePublishTarget("LIVE_READY")).thenReturn("LIVE_READY");

        assertThatThrownBy(() -> service.publish(TENANT, 21L, publishRequest(USER, "LIVE_READY")))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("not live-ready");
    }

    @Test
    void publish_toPaperReady_fails_whenNotPaperEligible() {
        IntraStrategyEntity strategy = strategyEntity("S", "DRAFT", false, false);
        setId(strategy, 22L);
        IntraStrategyVersionEntity version = mock(IntraStrategyVersionEntity.class);
        when(strategyRepository.findByIdAndTenantId(22L, TENANT)).thenReturn(Optional.of(strategy));
        when(versionRepository.findByStrategyIdAndVersionAndTenantIdAndUsername(any(), any(), any(), any()))
                .thenReturn(Optional.of(version));
        when(draftSupport.fromVersion(version)).thenReturn(builderModel("S"));
        when(validationEngine.validate(any())).thenReturn(validResult(false, false)); // not paper eligible
        when(mapper.normalizePublishTarget("PAPER_READY")).thenReturn("PAPER_READY");

        assertThatThrownBy(() -> service.publish(TENANT, 22L, publishRequest(USER, "PAPER_READY")))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("not paper-ready");
    }

    // ─── archive ──────────────────────────────────────────────────────────────

    @Test
    void archive_setsStatusAndArchivedAt() {
        IntraStrategyEntity strategy = strategyEntity("S", "PAPER_READY", true, false);
        setId(strategy, 30L);
        when(strategyRepository.findByIdAndTenantId(30L, TENANT)).thenReturn(Optional.of(strategy));
        when(strategyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var response = service.archive(TENANT, 30L, archiveRequest(USER));

        assertThat(response.status()).isEqualTo("archived");
        assertThat(response.strategyId()).isEqualTo(30L);
        ArgumentCaptor<IntraStrategyEntity> captor = ArgumentCaptor.forClass(IntraStrategyEntity.class);
        verify(strategyRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo("ARCHIVED");
        assertThat(captor.getValue().getArchivedAt()).isNotNull();
    }

    // ─── delete ───────────────────────────────────────────────────────────────

    @Test
    void delete_succeedsWhenNoExecutions() {
        IntraStrategyEntity strategy = strategyEntity("S", "DRAFT", false, false);
        setId(strategy, 40L);
        when(strategyRepository.findByIdAndTenantId(40L, TENANT)).thenReturn(Optional.of(strategy));
        when(executionRepository.existsByTenantIdAndStrategyId(TENANT, 40L)).thenReturn(false);

        var response = service.delete(TENANT, 40L, USER);

        assertThat(response.status()).isEqualTo("deleted");
        verify(strategyRepository).delete(strategy);
    }

    @Test
    void delete_throwsWhenExecutionsExistForStrategy() {
        IntraStrategyEntity strategy = strategyEntity("S", "PAPER_READY", true, false);
        setId(strategy, 41L);
        when(strategyRepository.findByIdAndTenantId(41L, TENANT)).thenReturn(Optional.of(strategy));
        when(executionRepository.existsByTenantIdAndStrategyId(TENANT, 41L)).thenReturn(true);

        assertThatThrownBy(() -> service.delete(TENANT, 41L, USER))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("cannot be deleted")
                .hasMessageContaining("Archive it instead");

        verify(strategyRepository, never()).delete(any());
    }

    // ─── listVersions / getVersion ────────────────────────────────────────────

    @Test
    void listVersions_returnsOrderedVersions() {
        IntraStrategyEntity strategy = strategyEntity("S", "DRAFT", false, false);
        setId(strategy, 50L);
        when(strategyRepository.findByIdAndTenantId(50L, TENANT)).thenReturn(Optional.of(strategy));
        IntraStrategyVersionEntity v1 = mock(IntraStrategyVersionEntity.class);
        IntraStrategyVersionEntity v2 = mock(IntraStrategyVersionEntity.class);
        when(versionRepository.findAllByStrategyIdAndTenantIdAndUsernameOrderByVersionDesc(50L, TENANT, USER))
                .thenReturn(List.of(v2, v1));
        when(mapper.toVersionResponse(any(IntraStrategyVersionEntity.class)))
                .thenAnswer(inv -> versionResponse(1));

        var versions = service.listVersions(TENANT, 50L, USER);

        assertThat(versions).hasSize(2);
    }

    @Test
    void getVersion_throwsWhenVersionNotFound() {
        IntraStrategyEntity strategy = strategyEntity("S", "DRAFT", false, false);
        setId(strategy, 51L);
        when(strategyRepository.findByIdAndTenantId(51L, TENANT)).thenReturn(Optional.of(strategy));
        when(versionRepository.findByStrategyIdAndVersionAndTenantIdAndUsername(51L, 99, TENANT, USER))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getVersion(TENANT, 51L, 99, USER))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("version was not found");
    }

    // ─── ownership / tenant checks ────────────────────────────────────────────

    @Test
    void listLibrary_throwsWhenStrategyNotFound() {
        when(strategyRepository.findByIdAndTenantId(99L, TENANT)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.archive(TENANT, 99L, archiveRequest(USER)))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("not found");
    }

    @Test
    void delete_throwsWhenStrategyBelongsToAnotherUser() {
        IntraStrategyEntity strategy = strategyEntity("S", "DRAFT", false, false);
        setId(strategy, 60L);
        // entity owned by 'other-user', request is from 'admin'
        when(strategyRepository.findByIdAndTenantId(60L, TENANT)).thenReturn(Optional.of(strategy));
        // mock mapper.requireText to return "other-user" for wrong-user case
        when(mapper.requireText("wrong-user", "username")).thenReturn("wrong-user");

        assertThatThrownBy(() -> service.delete(TENANT, 60L, "wrong-user"))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("belongs to another user");
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private IntraStrategyEntity strategyEntity(String name, String status, boolean paper, boolean live) {
        return new IntraStrategyEntity(TENANT, USER, name, "NSE_INDEX|Nifty 50",
                "minutes", 5, "INTRADAY", "REGULAR_MARKET",
                status, "DRAFT", 1, null, paper, live, USER, null);
    }

    private void setId(Object entity, Long id) {
        try {
            Field f = entity.getClass().getDeclaredField("id");
            f.setAccessible(true);
            f.set(entity, id);
        } catch (Exception e) {
            throw new RuntimeException("Could not set entity id", e);
        }
    }

    private IntraStrategyDraftSupport.BuilderModel builderModel(String name) {
        AdminDtos.BacktestStrategyPayload strategy = new AdminDtos.BacktestStrategyPayload(
                name, "NSE_INDEX|Nifty 50", "FUTURES", "INTRADAY",
                LocalTime.of(9, 35), LocalTime.of(15, 15),
                LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 23),
                List.of(new AdminDtos.BacktestLegPayload("leg-1", "OPTIONS", 1, "BUY", "CALL", "WEEKLY", "ATM", 0, null)),
                new AdminDtos.BacktestLegwiseSettingsPayload("PARTIAL", false, "ALL_LEGS", false, null, false, null, BigDecimal.ZERO),
                new AdminDtos.BacktestOverallSettingsPayload(false, null, BigDecimal.ZERO, false, null, BigDecimal.ZERO, false, null, BigDecimal.ZERO, BigDecimal.ZERO),
                new AdminDtos.BacktestAdvancedConditionsPayload(false, null, null));
        var payload = new IntraStrategyDtos.IntraStrategyBuilderPayload(strategy, "minutes", 5, false, "REGULAR_MARKET");
        return new IntraStrategyDraftSupport.BuilderModel(payload, strategy, "minutes", 5, false, "REGULAR_MARKET");
    }

    private IntraStrategyDtos.IntraStrategyValidationResult validResult(boolean paper, boolean live) {
        return new IntraStrategyDtos.IntraStrategyValidationResult(paper, paper, live, List.of(), List.of(), List.of());
    }

    private IntraStrategyDtos.IntraStrategyLibraryItem libraryItem(String name) {
        return new IntraStrategyDtos.IntraStrategyLibraryItem(1L, name, "NSE_INDEX|Nifty 50",
                "minutes", 5, "INTRADAY", "DRAFT", Instant.now(), USER, 1, true, false, null, null);
    }

    private IntraStrategyDtos.IntraStrategyDetailsResponse detailsResponse(String name) {
        return new IntraStrategyDtos.IntraStrategyDetailsResponse(libraryItem(name), null);
    }

    private IntraStrategyDtos.IntraStrategyVersionResponse versionResponse(int v) {
        return new IntraStrategyDtos.IntraStrategyVersionResponse(
                1L, 1L, v, false, "minutes", 5, null, null, Instant.now(), null);
    }

    private IntraStrategyDtos.IntraStrategyCreateDraftRequest createRequest(String user, String name) {
        var strategy = new AdminDtos.BacktestStrategyPayload(
                name, "NSE_INDEX|Nifty 50", "FUTURES", "INTRADAY",
                LocalTime.of(9, 35), LocalTime.of(15, 15),
                LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 23),
                List.of(new AdminDtos.BacktestLegPayload("leg-1", "OPTIONS", 1, "BUY", "CALL", "WEEKLY", "ATM", 0, null)),
                new AdminDtos.BacktestLegwiseSettingsPayload("PARTIAL", false, "ALL_LEGS", false, null, false, null, BigDecimal.ZERO),
                new AdminDtos.BacktestOverallSettingsPayload(false, null, BigDecimal.ZERO, false, null, BigDecimal.ZERO, false, null, BigDecimal.ZERO, BigDecimal.ZERO),
                new AdminDtos.BacktestAdvancedConditionsPayload(false, null, null));
        var payload = new IntraStrategyDtos.IntraStrategyBuilderPayload(strategy, "minutes", 5, false, "REGULAR_MARKET");
        return new IntraStrategyDtos.IntraStrategyCreateDraftRequest(user, payload);
    }

    private IntraStrategyDtos.IntraStrategyUpdateDraftRequest updateRequest(String user, String name) {
        var strategy = new AdminDtos.BacktestStrategyPayload(
                name, "NSE_INDEX|Nifty 50", "FUTURES", "INTRADAY",
                LocalTime.of(9, 35), LocalTime.of(15, 15),
                LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 23),
                List.of(new AdminDtos.BacktestLegPayload("leg-1", "OPTIONS", 1, "BUY", "CALL", "WEEKLY", "ATM", 0, null)),
                new AdminDtos.BacktestLegwiseSettingsPayload("PARTIAL", false, "ALL_LEGS", false, null, false, null, BigDecimal.ZERO),
                new AdminDtos.BacktestOverallSettingsPayload(false, null, BigDecimal.ZERO, false, null, BigDecimal.ZERO, false, null, BigDecimal.ZERO, BigDecimal.ZERO),
                new AdminDtos.BacktestAdvancedConditionsPayload(false, null, null));
        var payload = new IntraStrategyDtos.IntraStrategyBuilderPayload(strategy, "minutes", 5, false, "REGULAR_MARKET");
        return new IntraStrategyDtos.IntraStrategyUpdateDraftRequest(user, payload);
    }

    private IntraStrategyDtos.IntraStrategyPublishRequest publishRequest(String user, String target) {
        return new IntraStrategyDtos.IntraStrategyPublishRequest(user, target);
    }

    private IntraStrategyDtos.IntraStrategyArchiveRequest archiveRequest(String user) {
        return new IntraStrategyDtos.IntraStrategyArchiveRequest(user);
    }
}
