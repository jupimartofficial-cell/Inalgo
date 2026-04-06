package com.inalgo.trade.support;

import org.springframework.test.context.DynamicPropertyRegistry;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Locale;
import java.util.concurrent.ThreadLocalRandom;

public final class TestDatabaseSupport {
    private static final String BASE_DB_URL = System.getProperty(
            "trade.test.db.url",
            "jdbc:postgresql://localhost:5432/trade?sslmode=disable"
    );
    private static final String DB_USERNAME = System.getProperty("trade.test.db.username", "trade");
    private static final String DB_PASSWORD = System.getProperty("trade.test.db.password", "trade");

    private TestDatabaseSupport() {
    }

    public static String createIsolatedSchema(String prefix) {
        String schema = "it_" + sanitizePrefix(prefix) + "_" + Long.toUnsignedString(
                ThreadLocalRandom.current().nextLong(),
                36
        );

        try (Connection connection = DriverManager.getConnection(BASE_DB_URL, DB_USERNAME, DB_PASSWORD);
             Statement statement = connection.createStatement()) {
            statement.execute("CREATE SCHEMA IF NOT EXISTS " + schema);
        } catch (SQLException ex) {
            throw new IllegalStateException("Unable to create isolated test schema: " + schema, ex);
        }

        return schema;
    }

    public static void registerIsolatedSchemaProperties(DynamicPropertyRegistry registry, String schema) {
        String schemaUrl = appendSchema(BASE_DB_URL, schema);
        registry.add("spring.datasource.url", () -> schemaUrl);
        registry.add("spring.datasource.username", () -> DB_USERNAME);
        registry.add("spring.datasource.password", () -> DB_PASSWORD);
        registry.add("spring.flyway.default-schema", () -> schema);
        registry.add("spring.flyway.schemas", () -> schema);
        registry.add("spring.jpa.properties.hibernate.default_schema", () -> schema);
    }

    public static void dropSchema(String schema) {
        try (Connection connection = DriverManager.getConnection(BASE_DB_URL, DB_USERNAME, DB_PASSWORD);
             Statement statement = connection.createStatement()) {
            statement.execute("DROP SCHEMA IF EXISTS " + schema + " CASCADE");
        } catch (SQLException ex) {
            throw new IllegalStateException("Unable to drop isolated test schema: " + schema, ex);
        }
    }

    private static String sanitizePrefix(String prefix) {
        String normalized = prefix == null ? "test" : prefix.toLowerCase(Locale.ROOT);
        String sanitized = normalized.replaceAll("[^a-z0-9_]", "_");
        return sanitized.isBlank() ? "test" : sanitized;
    }

    private static String appendSchema(String baseUrl, String schema) {
        String separator = baseUrl.contains("?") ? "&" : "?";
        return baseUrl
                + separator
                + "currentSchema=" + schema
                + "&reWriteBatchedInserts=true"
                + "&ApplicationName=trade-backend-test";
    }
}
