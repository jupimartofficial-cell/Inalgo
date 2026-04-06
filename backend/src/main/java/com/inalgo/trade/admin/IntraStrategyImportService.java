package com.inalgo.trade.admin;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.inalgo.trade.entity.BacktestStrategyEntity;
import com.inalgo.trade.entity.IntraStrategyEntity;
import com.inalgo.trade.entity.IntraStrategyVersionEntity;
import com.inalgo.trade.repository.BacktestStrategyRepository;
import com.inalgo.trade.repository.IntraStrategyRepository;
import com.inalgo.trade.repository.IntraStrategyVersionRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
public class IntraStrategyImportService {

    private final BacktestStrategyRepository backtestStrategyRepository;
    private final IntraStrategyRepository intraStrategyRepository;
    private final IntraStrategyVersionRepository intraStrategyVersionRepository;
    private final BacktestStrategyService backtestStrategyService;
    private final IntraStrategyValidationEngine validationEngine;
    private final IntraStrategyMapperSupport mapper;
    private final ObjectMapper objectMapper;

    public IntraStrategyImportService(
            BacktestStrategyRepository backtestStrategyRepository,
            IntraStrategyRepository intraStrategyRepository,
            IntraStrategyVersionRepository intraStrategyVersionRepository,
            BacktestStrategyService backtestStrategyService,
            IntraStrategyValidationEngine validationEngine,
            IntraStrategyMapperSupport mapper,
            ObjectMapper objectMapper
    ) {
        this.backtestStrategyRepository = backtestStrategyRepository;
        this.intraStrategyRepository = intraStrategyRepository;
        this.intraStrategyVersionRepository = intraStrategyVersionRepository;
        this.backtestStrategyService = backtestStrategyService;
        this.validationEngine = validationEngine;
        this.mapper = mapper;
        this.objectMapper = objectMapper;
    }

    public IntraStrategyDtos.IntraStrategyImportResponse importFromBacktest(
            String tenantId,
            IntraStrategyDtos.IntraStrategyImportFromBacktestRequest request
    ) {
        String normalizedUsername = mapper.requireText(request.username(), "username");
        List<BacktestStrategyEntity> sourceRows;
        if (request.strategyIds() == null || request.strategyIds().isEmpty()) {
            sourceRows = backtestStrategyRepository.findAllByTenantIdAndUsername(tenantId, normalizedUsername);
        } else {
            sourceRows = request.strategyIds().stream()
                    .map(id -> backtestStrategyRepository.findByIdAndTenantId(id, tenantId).orElse(null))
                    .filter(item -> item != null && normalizedUsername.equals(item.getUsername()))
                    .toList();
        }

        List<IntraStrategyDtos.IntraStrategyImportResult> results = new ArrayList<>();
        for (BacktestStrategyEntity source : sourceRows) {
            try {
                AdminDtos.BacktestStrategyPayload raw = objectMapper.readValue(
                        source.getStrategyJson(),
                        AdminDtos.BacktestStrategyPayload.class
                );
                AdminDtos.BacktestStrategyPayload payload = backtestStrategyService.normalizeStrategyPayload(raw);
                IntraStrategyDtos.IntraStrategyBuilderPayload builder = new IntraStrategyDtos.IntraStrategyBuilderPayload(
                        payload,
                        "minutes",
                        5,
                        payload.advancedConditions() != null && Boolean.TRUE.equals(payload.advancedConditions().enabled()),
                        "REGULAR_MARKET"
                );
                IntraStrategyDtos.IntraStrategyValidationResult validation = validationEngine.validate(builder);

                IntraStrategyEntity strategyEntity = new IntraStrategyEntity(
                        tenantId,
                        normalizedUsername,
                        payload.strategyName(),
                        payload.underlyingKey(),
                        builder.timeframeUnit(),
                        builder.timeframeInterval(),
                        payload.strategyType(),
                        builder.marketSession(),
                        "DRAFT",
                        "DRAFT",
                        1,
                        null,
                        validation.paperEligible(),
                        validation.liveEligible(),
                        normalizedUsername,
                        source.getId()
                );
                strategyEntity = intraStrategyRepository.save(strategyEntity);
                IntraStrategyVersionEntity version = new IntraStrategyVersionEntity(
                        strategyEntity.getId(),
                        tenantId,
                        normalizedUsername,
                        1,
                        Boolean.TRUE.equals(builder.advancedMode()),
                        builder.timeframeUnit(),
                        builder.timeframeInterval(),
                        mapper.toJson(payload),
                        mapper.toJson(validation.fieldErrors()),
                        mapper.toJson(validation.summaryErrors()),
                        mapper.toJson(validation.warnings()),
                        validation.paperEligible(),
                        validation.liveEligible(),
                        Instant.now()
                );
                version = intraStrategyVersionRepository.save(version);
                strategyEntity.setCurrentVersionId(version.getId());
                intraStrategyRepository.save(strategyEntity);
                results.add(new IntraStrategyDtos.IntraStrategyImportResult(source.getId(), strategyEntity.getId(), "imported", "Imported"));
            } catch (DataIntegrityViolationException duplicate) {
                results.add(new IntraStrategyDtos.IntraStrategyImportResult(source.getId(), null, "skipped", "Already imported"));
            } catch (Exception ex) {
                results.add(new IntraStrategyDtos.IntraStrategyImportResult(source.getId(), null, "failed", ex.getMessage()));
            }
        }
        return new IntraStrategyDtos.IntraStrategyImportResponse(List.copyOf(results));
    }
}
