package com.inalgo.trade.admin;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class AdminTriggerScheduler {
    private final AdminTriggerService adminTriggerService;

    public AdminTriggerScheduler(AdminTriggerService adminTriggerService) {
        this.adminTriggerService = adminTriggerService;
    }

    @Scheduled(fixedDelayString = "${admin.triggers.poll-ms:15000}")
    public void runTriggerTick() {
        adminTriggerService.processDueTriggers();
    }
}
