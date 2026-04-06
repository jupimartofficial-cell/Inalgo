package com.inalgo.trade.config;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;

import java.net.Authenticator;
import java.net.PasswordAuthentication;

/**
 * Installs a global JVM Authenticator so that java.net.http.HttpClient
 * (used by Spring RestClient) can authenticate with the egress proxy
 * configured via https.proxyHost / https.proxyUser / https.proxyPassword
 * system properties (set in JAVA_TOOL_OPTIONS in this environment).
 */
@Configuration
public class ProxyAuthConfig {

    private static final Logger log = LoggerFactory.getLogger(ProxyAuthConfig.class);

    @PostConstruct
    public void installProxyAuthenticator() {
        String proxyHost = System.getProperty("https.proxyHost", System.getProperty("http.proxyHost", ""));
        String proxyUser = System.getProperty("https.proxyUser", System.getProperty("http.proxyUser", ""));
        String proxyPass = System.getProperty("https.proxyPassword", System.getProperty("http.proxyPassword", ""));

        if (proxyHost.isBlank() || proxyUser.isBlank() || proxyPass.isBlank()) {
            log.info("No proxy credentials found in system properties; skipping global Authenticator setup.");
            return;
        }

        log.info("Installing global proxy Authenticator for host={}", proxyHost);
        Authenticator.setDefault(new Authenticator() {
            @Override
            protected PasswordAuthentication getPasswordAuthentication() {
                if (getRequestorType() == RequestorType.PROXY) {
                    return new PasswordAuthentication(proxyUser, proxyPass.toCharArray());
                }
                return null;
            }
        });
    }
}
