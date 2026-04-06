package com.inalgo.trade.admin;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.inalgo.trade.entity.IntraEventAuditEntity;
import com.inalgo.trade.entity.IntraPositionSnapshotEntity;
import com.inalgo.trade.entity.IntraRuntimeStrategyEntity;
import com.inalgo.trade.repository.IntraEventAuditRepository;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;

@Service
public class IntraMonitorAuditService {

    private final IntraEventAuditRepository eventRepository;
    private final ObjectMapper objectMapper;

    public IntraMonitorAuditService(IntraEventAuditRepository eventRepository, ObjectMapper objectMapper) {
        this.eventRepository = eventRepository;
        this.objectMapper = objectMapper;
    }

    public void appendEvent(
            String tenantId,
            String username,
            IntraRuntimeStrategyEntity runtime,
            IntraPositionSnapshotEntity position,
            String eventType,
            String severity,
            String mode,
            String message,
            String reason,
            Map<String, Object> before,
            Map<String, Object> after,
            String actor
    ) {
        IntraEventAuditEntity event = new IntraEventAuditEntity();
        event.setTenantId(tenantId);
        event.setUsername(username);
        event.setRuntime(runtime);
        event.setExecutionId(runtime == null ? null : runtime.getExecutionId());
        event.setPosition(position);
        event.setEventType(eventType);
        event.setSeverity(severity);
        event.setMode(mode);
        event.setMessage(message);
        event.setReason(reason);
        event.setBeforeStateJson(toJson(before));
        event.setAfterStateJson(toJson(after));
        event.setCorrelationId(UUID.randomUUID().toString());
        event.setActor(actor);
        eventRepository.save(event);
    }

    private String toJson(Map<String, Object> map) {
        if (map == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(map);
        } catch (Exception ex) {
            return "{}";
        }
    }
}
