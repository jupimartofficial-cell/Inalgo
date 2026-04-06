package com.inalgo.trade.admin;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.ValidationException;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.concurrent.TimeUnit;

@Component
public class TradingScriptWorkerClient {

    private final ObjectMapper objectMapper;
    private final TradingScriptProperties properties;

    public TradingScriptWorkerClient(ObjectMapper objectMapper, TradingScriptProperties properties) {
        this.objectMapper = objectMapper;
        this.properties = properties;
    }

    public TradingScriptDtos.TradingScriptCompileResponse compile(String sourceJs) {
        if (!properties.isEnabled()) {
            throw new ValidationException("Trading script worker is disabled");
        }
        if (sourceJs.length() > properties.getMaxSourceLength()) {
            throw new ValidationException("sourceJs exceeds the configured maximum length");
        }
        Path workerPath = resolveWorkerPath();
        if (!Files.exists(workerPath)) {
            throw new ValidationException("Trading script worker was not found at " + workerPath);
        }

        Process process;
        try {
            process = new ProcessBuilder(
                    properties.getWorkerCommand(),
                    "--max-old-space-size=" + properties.getWorkerMemoryMb(),
                    workerPath.toString()
            ).start();
        } catch (IOException ex) {
            throw new ValidationException("Unable to start trading script worker");
        }

        try (var stdin = process.getOutputStream()) {
            stdin.write(objectMapper.writeValueAsBytes(new WorkerRequest("compile", sourceJs)));
            stdin.flush();
        } catch (IOException ex) {
            process.destroyForcibly();
            throw new ValidationException("Unable to send payload to trading script worker");
        }

        boolean finished;
        try {
            finished = process.waitFor(properties.getWorkerTimeoutMs(), TimeUnit.MILLISECONDS);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            process.destroyForcibly();
            throw new ValidationException("Trading script worker was interrupted");
        }
        if (!finished) {
            process.destroyForcibly();
            throw new ValidationException("Trading script worker timed out");
        }

        try {
            String stdout = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            String stderr = new String(process.getErrorStream().readAllBytes(), StandardCharsets.UTF_8);
            if (process.exitValue() != 0 && stdout.isBlank()) {
                throw new ValidationException("Trading script worker failed" + (stderr.isBlank() ? "" : ": " + stderr.trim()));
            }
            TradingScriptDtos.TradingScriptCompileResponse response = objectMapper.readValue(stdout, TradingScriptDtos.TradingScriptCompileResponse.class);
            return new TradingScriptDtos.TradingScriptCompileResponse(
                    response.compileStatus(),
                    response.valid(),
                    false,
                    false,
                    response.diagnostics(),
                    response.artifact(),
                    response.warnings()
            );
        } catch (IOException ex) {
            throw new ValidationException("Trading script worker returned invalid JSON");
        }
    }

    private Path resolveWorkerPath() {
        Path configured = Path.of(properties.getWorkerScriptPath());
        if (configured.isAbsolute()) {
            return configured.normalize();
        }
        return Path.of(System.getProperty("user.dir")).resolve(configured).normalize();
    }

    private record WorkerRequest(String action, String sourceJs) {
    }
}
