package com.inalgo.trade.admin;

import com.inalgo.trade.entity.AdminTriggerEntity;

/**
 * Derived trigger view used while building the browse response.
 */
record TriggerDescriptor(
        AdminTriggerEntity trigger,
        String tabGroup,
        String jobNatureKey,
        String jobNatureLabel,
        String timeframeKey,
        String timeframeLabel,
        boolean oneTime
) {
}
