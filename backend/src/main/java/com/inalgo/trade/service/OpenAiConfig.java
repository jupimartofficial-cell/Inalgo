package com.inalgo.trade.service;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.net.ProxySelector;
import java.net.http.HttpClient;
import java.time.Duration;

@Configuration
@EnableConfigurationProperties(OpenAiProperties.class)
public class OpenAiConfig {
    @Bean
    @Qualifier("openAiRestClient")
    RestClient openAiRestClient(RestClient.Builder builder, OpenAiProperties properties) {
        HttpClient httpClient = HttpClient.newBuilder()
                .proxy(ProxySelector.of(null))
                .connectTimeout(Duration.ofSeconds(Math.max(properties.requestTimeoutSeconds(), 5)))
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(Duration.ofSeconds(Math.max(properties.requestTimeoutSeconds(), 5)));

        return builder
                .baseUrl(properties.baseUrl())
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.USER_AGENT, "InAlgo-OpenAI/1.0")
                .defaultHeader(HttpHeaders.ACCEPT, "application/json")
                .build();
    }

    @Bean
    @Qualifier("openAiWebSearchRestClient")
    RestClient openAiWebSearchRestClient(RestClient.Builder builder, OpenAiProperties properties) {
        int timeout = Math.max(properties.webSearchTimeoutSeconds(), 20);
        HttpClient httpClient = HttpClient.newBuilder()
                .proxy(ProxySelector.of(null))
                .connectTimeout(Duration.ofSeconds(10))
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(Duration.ofSeconds(timeout));

        return builder
                .baseUrl(properties.baseUrl())
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.USER_AGENT, "InAlgo-OpenAI/1.0")
                .defaultHeader(HttpHeaders.ACCEPT, "application/json")
                .build();
    }
}
