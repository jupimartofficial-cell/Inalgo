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
@EnableConfigurationProperties(MarketSentimentProperties.class)
public class MarketSentimentConfig {
    @Bean
    @Qualifier("marketSentimentRestClient")
    RestClient marketSentimentRestClient(RestClient.Builder builder, MarketSentimentProperties properties) {
        HttpClient httpClient = HttpClient.newBuilder()
                .proxy(ProxySelector.of(null))
                .connectTimeout(Duration.ofSeconds(Math.max(properties.requestTimeoutSeconds(), 5)))
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(Duration.ofSeconds(Math.max(properties.requestTimeoutSeconds(), 5)));

        return builder
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.USER_AGENT, "InAlgo-MarketSentiment/1.0")
                .defaultHeader(HttpHeaders.ACCEPT_LANGUAGE, "en-US,en;q=0.9")
                .build();
    }
}
