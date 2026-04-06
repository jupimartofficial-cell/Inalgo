package com.inalgo.trade.upstox;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.net.ProxySelector;
import java.net.http.HttpClient;

@Configuration
@EnableConfigurationProperties({UpstoxProperties.class, UpstoxMigrationProperties.class, UpstoxOptionChainProperties.class})
public class UpstoxClientConfig {

    @Bean
    RestClient upstoxRestClient(RestClient.Builder builder, UpstoxProperties properties, UpstoxTokenService tokenService) {
        return buildRestClient(builder, properties.baseUrl(), tokenService);
    }

    @Bean(name = "upstoxOrderRestClient")
    RestClient upstoxOrderRestClient(RestClient.Builder builder, UpstoxProperties properties, UpstoxTokenService tokenService) {
        return buildRestClient(builder, properties.orderBaseUrl(), tokenService);
    }

    private RestClient buildRestClient(RestClient.Builder builder, String baseUrl, UpstoxTokenService tokenService) {
        HttpClient noProxyHttpClient = HttpClient.newBuilder()
                .proxy(ProxySelector.of(null))
                .build();

        return builder
                .baseUrl(baseUrl)
                .requestFactory(new JdkClientHttpRequestFactory(noProxyHttpClient))
                .requestInterceptor((request, body, execution) -> {
                    String token = tokenService.getTokenForTenant(com.inalgo.trade.security.TenantContext.getTenantId());
                    request.getHeaders().set(HttpHeaders.AUTHORIZATION, "Bearer " + token);
                    return execution.execute(request, body);
                })
                .defaultHeader("Accept", "application/json")
                .defaultHeader(HttpHeaders.USER_AGENT, "InAlgo-UpstoxClient/1.0")
                .defaultHeader(HttpHeaders.ORIGIN, baseUrl)
                .defaultHeader(HttpHeaders.REFERER, baseUrl + "/")
                .build();
    }
}
