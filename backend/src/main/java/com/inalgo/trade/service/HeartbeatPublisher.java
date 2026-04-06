package com.inalgo.trade.service;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;

@Component
public class HeartbeatPublisher {
    private final SimpMessagingTemplate messagingTemplate;

    public HeartbeatPublisher(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    @Scheduled(fixedDelayString = "${app.heartbeat-ms:5000}")
    public void publishHeartbeat() {
        messagingTemplate.convertAndSend("/topic/heartbeat", Map.of("timestamp", Instant.now().toString()));
    }
}
