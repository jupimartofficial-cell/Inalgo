package com.inalgo.trade.security;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ApiRateLimitFilterTest {

    private MockMvc buildMockMvc(int perSecond, int perMinute, int perHour) {
        ApiRateLimitFilter filter = new ApiRateLimitFilter(new ApiRateLimitProperties(perSecond, perMinute, perHour));
        return MockMvcBuilders.standaloneSetup(new RateLimitTestController())
                .addFilters(filter)
                .build();
    }

    @Test
    void blocksAdminLoginWhenMinuteRateLimitExceeded() throws Exception {
        MockMvc mockMvc = buildMockMvc(50, 2, 10);

        mockMvc.perform(post("/api/v1/admin/login")
                        .header(TenantHeaderFilter.TENANT_HEADER, "tenant-a")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"secret\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/admin/login")
                        .header(TenantHeaderFilter.TENANT_HEADER, "tenant-a")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"secret\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/admin/login")
                        .header(TenantHeaderFilter.TENANT_HEADER, "tenant-a")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"secret\"}"))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void blocksBurstApiRequestsWhenPerSecondLimitExceeded() throws Exception {
        MockMvc mockMvc = buildMockMvc(2, 5, 25);

        mockMvc.perform(get("/api/v1/ping")).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/ping")).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/ping")).andExpect(status().isTooManyRequests());
    }

    @RestController
    @RequestMapping("/api/v1")
    static class RateLimitTestController {
        @GetMapping("/ping")
        public String ping() {
            return "pong";
        }

        @PostMapping("/admin/login")
        public String login(@RequestBody String ignored) {
            return "ok";
        }
    }
}
