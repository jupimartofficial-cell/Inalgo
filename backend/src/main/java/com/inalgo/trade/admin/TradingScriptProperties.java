package com.inalgo.trade.admin;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "trading.scripts")
public class TradingScriptProperties {
    private boolean enabled = true;
    private String workerCommand = "node";
    private String workerScriptPath = "../scripts/trading-script-worker.mjs";
    private long workerTimeoutMs = 8000;
    private int workerMemoryMb = 96;
    private int maxSourceLength = 50000;

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public String getWorkerCommand() { return workerCommand; }
    public void setWorkerCommand(String workerCommand) { this.workerCommand = workerCommand; }
    public String getWorkerScriptPath() { return workerScriptPath; }
    public void setWorkerScriptPath(String workerScriptPath) { this.workerScriptPath = workerScriptPath; }
    public long getWorkerTimeoutMs() { return workerTimeoutMs; }
    public void setWorkerTimeoutMs(long workerTimeoutMs) { this.workerTimeoutMs = workerTimeoutMs; }
    public int getWorkerMemoryMb() { return workerMemoryMb; }
    public void setWorkerMemoryMb(int workerMemoryMb) { this.workerMemoryMb = workerMemoryMb; }
    public int getMaxSourceLength() { return maxSourceLength; }
    public void setMaxSourceLength(int maxSourceLength) { this.maxSourceLength = maxSourceLength; }
}
