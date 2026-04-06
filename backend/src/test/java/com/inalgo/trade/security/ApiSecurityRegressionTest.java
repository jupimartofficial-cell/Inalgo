package com.inalgo.trade.security;

import com.inalgo.trade.config.ApiSecurityHeadersFilter;
import com.inalgo.trade.controller.ApiExceptionHandler;
import com.inalgo.trade.controller.CandleController;
import com.inalgo.trade.service.CandleService;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.Mockito.mock;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ApiSecurityRegressionTest {

    private final MockMvc mockMvc = MockMvcBuilders
            .standaloneSetup(new CandleController(mock(CandleService.class)))
            .setControllerAdvice(new ApiExceptionHandler())
            .addFilters(new ApiSecurityHeadersFilter(), new TenantHeaderFilter())
            .build();

    @Test
    void rejectsMissingTenantHeader() throws Exception {
        mockMvc.perform(get("/api/v1/candles"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsInvalidTenantHeader() throws Exception {
        mockMvc.perform(get("/api/v1/candles").header(TenantHeaderFilter.TENANT_HEADER, "bad tenant id"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void addsDefensiveSecurityHeadersToApiResponses() throws Exception {
        mockMvc.perform(get("/api/v1/candles").header(TenantHeaderFilter.TENANT_HEADER, "tenant-a"))
                .andExpect(status().isBadRequest())
                .andExpect(header().string("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("X-Frame-Options", "DENY"))
                .andExpect(header().string("Referrer-Policy", "no-referrer"))
                .andExpect(header().string("Permissions-Policy", "camera=(), microphone=(), geolocation=()"));
    }
}
